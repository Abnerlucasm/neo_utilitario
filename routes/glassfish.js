const express = require('express');
const router = express.Router();
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const xml2js = require('xml2js');
const { Glassfish } = require('../models/postgresql/associations');
const authMiddleware = require('../middlewares/auth');
const logger = require('../utils/logger');

// ─── Helper: expande config JSONB nos campos virtuais para o frontend ─────────
function expandService(s) {
    const base = s.toJSON ? s.toJSON() : s;
    const cfg  = base.config || {};
    return {
        ...base,
        ip:             base.host,
        sshUsername:    base.username,
        sshPassword:    cfg.sshPassword    || base.password || '',
        installPath:    cfg.installPath    || '/srv/glassfish6.2.5',
        setor:          cfg.setor          || '',
        accessType:     cfg.accessType     || 'local',
        productionPort: cfg.productionPort || 8080,
        inUse:          cfg.inUse          || false,
        inUseBy:        cfg.inUseBy        || '',
        pid:            cfg.pid            || null,
    };
}


// ─── Upload config ────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename:    (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

// ─── Middleware de log ────────────────────────────────────────────────────────
router.use((req, res, next) => {
    logger.info(`[Glassfish Router] ${req.method} ${req.url}`);
    next();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Executa um comando SSH no servidor remoto.
 * Usa os getters virtuais do modelo (service.ip, service.sshUsername, etc.)
 */
async function executeSSHCommand(service, command, timeout = 30000) {
    const ssh = new NodeSSH();
    try {
        logger.info(`SSH → ${service.ip}`, { command });
        await ssh.connect({
            host:               service.ip,         // getter virtual → host
            username:           service.sshUsername, // getter virtual → username
            password:           service.sshPassword, // getter virtual → config.sshPassword || password
            readyTimeout:       timeout,
            keepaliveInterval:  10000,
            keepaliveCountMax:  3,
            timeout:            30000
        });

        const result = await ssh.execCommand(command, {
            cwd: '/',
            onStderr: (chunk) => logger.warn('SSH stderr:', chunk.toString('utf8')),
            timeout: 20000
        });

        if (result.stderr?.includes('No such file or directory')) {
            throw new Error(`Arquivo/diretório não encontrado: ${result.stderr}`);
        }

        return { code: result.code || 0, stdout: result.stdout || '', stderr: result.stderr || '' };
    } catch (error) {
        logger.error(`Erro SSH para ${service.ip}:`, { error: error.message, command });

        if (error.message.includes('ECONNREFUSED'))
            throw new Error(`Servidor ${service.ip} não está aceitando conexões SSH (porta 22)`);
        if (error.message.includes('ETIMEDOUT') || error.message.includes('Timed out'))
            throw new Error(`Timeout ao conectar com ${service.ip}`);
        if (error.message.includes('Authentication failed'))
            throw new Error(`Falha na autenticação SSH para ${service.ip}`);

        throw error;
    } finally {
        ssh.dispose();
    }
}

/** Executa comando SSH com assinatura alternativa (host, user, pass, cmd) */
async function executeRemoteCommand(host, username, password, command, timeout = 30000) {
    const ssh = new NodeSSH();
    try {
        await ssh.connect({ host, username, password, readyTimeout: timeout });
        return await ssh.execCommand(command, { cwd: '/', onStderr: (c) => logger.error('SSH stderr:', c.toString()) });
    } finally {
        ssh.dispose();
    }
}

/** Constrói caminhos padrão do Glassfish com base no modelo */
function buildGlassfishPaths(service) {
    // Fallback para config JSONB e default para registros antigos
    const installPath = service.installPath
        || service.config?.installPath
        || '/srv/glassfish6.2.5';
    const domain = service.domain || 'domain1';
    const base = installPath.replace(/\/$/, '');
    return {
        binPath:    `${base}/glassfish/bin`,
        logsPath:   `${base}/glassfish/domains/${domain}/logs`,
        domainPath: `${base}/glassfish/domains/${domain}`,
        asadmin:    `${base}/glassfish/bin/asadmin`
    };
}


/** Retorna o installPath do serviço com fallback para config e default */
function getInstallPath(service) {
    return (service.installPath || service.config?.installPath || '/srv/glassfish6.2.5').replace(/\/$/, '');
}

/** Retorna o domain do serviço com fallback */
function getDomain(service) {
    return service.domain || 'domain1';
}

/** Retorna a senha SSH do serviço com fallback para config */
function getSshPassword(service) {
    return service.sshPassword || service.config?.sshPassword || service.password || '';
}

/** Verifica status real do serviço via SSH */
async function checkGlassfishStatus(service) {
    try {
        const installPath = (service.installPath || '/srv/glassfish6.2.5').replace(/\/$/, '');
        const adminPort   = service.port        || 4848;
        const domain      = service.domain      || 'domain1';

        // ── Estratégia 1: verificar se a porta admin está respondendo ────────
        // É o método mais confiável — independe de como o processo foi iniciado
        const portCheck = await executeSSHCommand(
            service,
            `(nc -z -w3 localhost ${adminPort} 2>/dev/null || curl -s --max-time 3 http://localhost:${adminPort}/ > /dev/null 2>&1) && echo "open" || echo "closed"`
        );
        const portOpen = portCheck.stdout.trim() === 'open';

        if (portOpen) {
            // Tentar pegar o PID para informação extra (não é obrigatório)
            let pid = null;
            try {
                // Procura por qualquer java com o domain name, ou qualquer java na porta admin
                const pidResult = await executeSSHCommand(
                    service,
                    `ps aux | grep -E "[j]ava.*(${domain}|glassfish)" | grep -v grep | awk '{print $2}' | head -1`
                );
                pid = parseInt(pidResult.stdout.trim()) || null;
            } catch { /* PID opcional */ }

            return { status: 'active', pid, details: { method: 'port_check', port: adminPort } };
        }

        // ── Estratégia 2: asadmin list-domains ──────────────────────────────
        // Fallback para quando nc/curl não estão disponíveis
        try {
            const asadminResult = await executeSSHCommand(
                service,
                `${installPath}/glassfish/bin/asadmin list-domains 2>/dev/null | grep -i "${domain}"`
            );
            if (asadminResult.stdout.toLowerCase().includes('running')) {
                return { status: 'active', pid: null, details: { method: 'asadmin' } };
            }
        } catch { /* asadmin falhou — continua */ }

        // ── Estratégia 3: verificar processo Java direto ─────────────────────
        try {
            const psResult = await executeSSHCommand(
                service,
                `ps aux | grep -E "[j]ava.*(${domain}|glassfish)" | grep -v grep | awk '{print $2}' | head -1`
            );
            const pid = parseInt(psResult.stdout.trim()) || null;
            if (pid) {
                // Processo existe mas porta não responde — pode estar iniciando
                return { status: 'inactive', pid, details: { method: 'ps', note: 'process_exists_port_closed' } };
            }
        } catch { /* ignorado */ }

        return { status: 'inactive', pid: null, details: { method: 'all_failed' } };

    } catch (error) {
        logger.error('Erro ao verificar status:', { service: service.name, error: error.message });
        return { status: 'error', pid: null, details: { error: 'check_failed', message: error.message } };
    }
}

/** Lê o domain.xml do servidor remoto */
async function tryReadDomainXml(service) {
    const domainPath = `${getInstallPath(service)}/glassfish/domains/${getDomain(service)}/config/domain.xml`;
    const result = await executeSSHCommand(service, `cat "${domainPath}"`);
    if (result.code !== 0 || !result.stdout)
        throw new Error('Erro ao ler domain.xml: ' + (result.stderr || 'Arquivo não encontrado'));
    return { stdout: result.stdout, filePath: domainPath };
}

/** Salva campos do config JSONB sem sobrescrever os demais */
async function patchConfig(service, patch) {
    service.config = { ...(service.config || {}), ...patch };
    service.changed('config', true); // força o Sequelize a detectar mudança no JSONB
    await service.save();
}

// ─── ROTAS ────────────────────────────────────────────────────────────────────

// GET /servicos — lista todos os servidores
router.get('/servicos', authMiddleware, async (req, res) => {
    try {
        const servers = await Glassfish.findAll({ order: [['name', 'ASC']] });
        // Expande explicitamente todos os campos virtuais + config na resposta
        // para garantir que o frontend receba tudo mesmo com model antigo
        res.json(servers.map(s => {
            const base = s.toJSON();
            const cfg  = base.config || {};
            return {
                ...base,
                // campos virtuais mapeados explicitamente
                ip:             base.host,
                sshUsername:    base.username,
                sshPassword:    cfg.sshPassword    || base.password || '',
                installPath:    cfg.installPath    || '/srv/glassfish6.2.5',
                setor:          cfg.setor          || '',
                accessType:     cfg.accessType     || 'local',
                productionPort: cfg.productionPort || 8080,
                inUse:          cfg.inUse          || false,
                inUseBy:        cfg.inUseBy        || '',
                pid:            cfg.pid            || null,
            };
        }));
    } catch (error) {
        logger.error('Erro ao listar servidores:', error);
        res.status(500).json({ error: 'Erro ao listar servidores' });
    }
});

// GET /servicos/stats/overview
router.get('/servicos/stats/overview', authMiddleware, async (req, res) => {
    try {
        const servers = await Glassfish.findAll();
        res.json({
            total:     servers.length,
            active:    servers.filter(s => s.status === 'active').length,
            inactive:  servers.filter(s => s.status === 'inactive').length,
            avgMemory: 0,
            avgCpu:    0
        });
    } catch (error) {
        logger.error('Erro ao obter estatísticas:', error);
        res.status(500).json({ error: 'Erro ao obter estatísticas' });
    }
});

// POST /servicos — cria novo servidor
router.post('/servicos', authMiddleware, async (req, res) => {
    try {
        const body = req.body;

        if (!body.name || !body.ip || !body.domain || !body.sshUsername || !body.sshPassword || !body.installPath) {
            return res.status(400).json({ error: 'Campos obrigatórios: name, ip, domain, sshUsername, sshPassword, installPath' });
        }

        const server = await Glassfish.create({
            name:     body.name,
            host:     body.ip,                          // ip → host
            port:     parseInt(body.port) || 4848,
            username: body.sshUsername,                 // sshUsername → username
            password: body.sshPassword,                 // senha SSH base
            domain:   body.domain,
            status:   'inactive',
            config: {
                sshPassword:    body.sshPassword,
                installPath:    body.installPath || '/srv/glassfish6.2.5',
                productionPort: parseInt(body.productionPort) || 8080,
                setor:          body.setor || '',
                accessType:     body.accessType || 'local',
                inUse:          false,
                inUseBy:        ''
            }
        });

        res.status(201).json(expandService(server));
    } catch (error) {
        logger.error('Erro ao criar servidor:', error);
        res.status(500).json({ error: 'Erro ao criar servidor', details: error.message });
    }
});

// PUT /servicos/:id — atualiza servidor
router.put('/servicos/:id', authMiddleware, async (req, res) => {
    try {
        const server = await Glassfish.findByPk(req.params.id);
        if (!server) return res.status(404).json({ error: 'Servidor não encontrado' });

        const body = req.body;

        // Mescla config existente com novos valores — campos omitidos mantêm o valor atual
        const updatedConfig = {
            ...(server.config || {}),
            sshPassword:    body.sshPassword    || server.sshPassword,
            installPath:    body.installPath    || server.installPath,
            productionPort: parseInt(body.productionPort) || server.productionPort,
            setor:          body.setor          !== undefined ? body.setor    : server.setor,
            accessType:     body.accessType     || server.accessType,
        };

        await server.update({
            name:     body.name       || server.name,
            host:     body.ip         || server.host,
            port:     parseInt(body.port) || server.port,
            username: body.sshUsername || server.username,
            password: body.sshPassword || server.password,
            domain:   body.domain     || server.domain,
            config:   updatedConfig
        });

        // reload() garante que o toJSON() reflita os valores persistidos
        await server.reload();
        res.json(expandService(server));
    } catch (error) {
        logger.error('Erro ao atualizar servidor:', error);
        res.status(500).json({ error: 'Erro ao atualizar servidor', details: error.message });
    }
});

// DELETE /servicos/:id
router.delete('/servicos/:id', authMiddleware, async (req, res) => {
    try {
        const server = await Glassfish.findByPk(req.params.id);
        if (!server) return res.status(404).json({ error: 'Servidor não encontrado' });
        await server.destroy();
        res.status(204).send();
    } catch (error) {
        logger.error('Erro ao excluir servidor:', error);
        res.status(500).json({ error: 'Erro ao excluir servidor' });
    }
});

// GET /servicos/:id/status
router.get('/servicos/:id/status', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const status = await checkGlassfishStatus(service);

        if (status.status !== 'error') {
            // update() persiste no banco; atribuição direta não é suficiente
            await service.update({ status: status.status });
            await patchConfig(service, { pid: status.pid });
        }

        res.json(status);
    } catch (error) {
        logger.error('Erro ao verificar status:', error);
        res.status(500).json({ error: 'Erro ao verificar status', details: error.message });
    }
});

// GET /servicos/:id/logs
router.get('/servicos/:id/logs', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const paths = buildGlassfishPaths(service);

        // Tenta server.log primeiro, depois system.log como fallback
        const logFiles = [
            `${paths.logsPath}/server.log`,
            `${paths.logsPath}/server.log.0`,
            `${paths.domainPath}/logs/server.log`,
        ];

        let logs = null;
        let lastError = '';

        for (const logFile of logFiles) {
            try {
                const result = await executeSSHCommand(service, `tail -n 200 "${logFile}" 2>/dev/null`);
                if (result.code === 0 && result.stdout.trim()) {
                    logs = result.stdout;
                    break;
                }
                lastError = result.stderr || `arquivo não encontrado: ${logFile}`;
            } catch (e) {
                lastError = e.message;
            }
        }

        if (logs !== null) {
            res.json({ logs });
        } else {
            res.status(500).json({
                error: 'Arquivo de log não encontrado',
                details: lastError,
                tried: logFiles
            });
        }
    } catch (error) {
        logger.error('Erro ao obter logs:', error);
        res.status(500).json({ error: 'Erro ao obter logs', details: error.message });
    }
});

// GET /servicos/:id/domain-config
router.get('/servicos/:id/domain-config', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const result = await tryReadDomainXml(service);
        const parser = new xml2js.Parser({ explicitArray: true, mergeAttrs: false, attrkey: '$' });
        const xmlData = await parser.parseStringPromise(result.stdout);

        const resources = xmlData.domain?.resources?.[0];
        if (!resources?.['jdbc-connection-pool'])
            throw new Error('Estrutura do XML inválida: jdbc-connection-pool não encontrado');

        const pool = resources['jdbc-connection-pool'].find(p => p.$.name === 'Pg_Neocorp_Pool');
        if (!pool) throw new Error('Pool Pg_Neocorp_Pool não encontrado');

        const config = { serverName: '', user: '', password: '', databaseName: '' };
        (pool.property || []).forEach(prop => {
            if (prop?.$) {
                if (prop.$.name === 'serverName')  config.serverName  = prop.$.value;
                if (prop.$.name === 'user')         config.user        = prop.$.value;
                if (prop.$.name === 'password')     config.password    = prop.$.value;
                if (prop.$.name === 'databaseName') config.databaseName = prop.$.value;
            }
        });

        res.json(config);
    } catch (error) {
        logger.error('Erro ao ler configurações:', error);
        res.status(500).json({ error: 'Erro ao ler configurações', details: error.message });
    }
});

// PUT /servicos/:id/domain-config
router.put('/servicos/:id/domain-config', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const result = await tryReadDomainXml(service);
        const parser = new xml2js.Parser({ explicitArray: false });
        const xmlData = await parser.parseStringPromise(result.stdout);

        const pools = Array.isArray(xmlData.domain.resources['jdbc-connection-pool'])
            ? xmlData.domain.resources['jdbc-connection-pool']
            : [xmlData.domain.resources['jdbc-connection-pool']];

        const pool = pools.find(p => p.$?.name === 'Pg_Neocorp_Pool');
        if (!pool) throw new Error('Pool de conexão não encontrado');

        const props = Array.isArray(pool.property) ? pool.property : [pool.property];
        props.forEach(prop => {
            if (prop?.$) {
                if (prop.$.name === 'serverName')   prop.$.value = req.body.serverName;
                if (prop.$.name === 'user')          prop.$.value = req.body.user;
                if (prop.$.name === 'password')      prop.$.value = req.body.password;
                if (prop.$.name === 'databaseName')  prop.$.value = req.body.databaseName;
            }
        });

        const updatedXml = new xml2js.Builder().buildObject(xmlData);
        const tempFile   = '/tmp/domain.xml.tmp';
        const writeResult = await executeSSHCommand(
            service,
            `echo '${updatedXml.replace(/'/g, "'\\''")}' > ${tempFile} && sudo mv ${tempFile} "${result.filePath}"`
        );

        if (writeResult.code !== 0) throw new Error(`Erro ao salvar arquivo: ${writeResult.stderr}`);

        res.json({ message: 'Configurações atualizadas com sucesso' });
    } catch (error) {
        logger.error('Erro ao salvar configurações:', error);
        res.status(500).json({ error: 'Erro ao salvar configurações', details: error.message });
    }
});

// GET /servicos/:id/applications
router.get('/servicos/:id/applications', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const result = await tryReadDomainXml(service);
        const parser = new xml2js.Parser({ explicitArray: true, mergeAttrs: false, attrkey: '$' });
        const xmlData = await parser.parseStringPromise(result.stdout);

        const applications = [];
        (xmlData.domain?.applications?.[0]?.application || []).forEach(app => {
            if (app.$['object-type'] === 'user') {
                applications.push({
                    name:     app.$.name,
                    status:   'deployed',
                    enabled:  app.$.enable === 'true',
                    location: app.$.location || `${getInstallPath(service)}/glassfish/domains/${getDomain(service)}/applications/${app.$.name}`
                });
            }
        });

        res.json({ status: 'success', applications });
    } catch (error) {
        logger.error('Erro ao listar aplicações:', error);
        res.status(500).json({ error: 'Erro ao listar aplicações', details: error.message });
    }
});

// POST /servicos/:id/start
router.post('/servicos/:id/start', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const result = await executeSSHCommand(
            service,
            `echo '${getSshPassword(service)}' | sudo -S bash -c 'cd ${getInstallPath(service)}/glassfish/bin && ./asadmin start-domain ${getDomain(service)}'`,
            60000
        );

        if (result.code !== 0) throw new Error(result.stderr || 'Erro ao iniciar serviço');

        await service.update({ status: 'active' });
        res.json({ message: 'Serviço iniciado com sucesso' });
    } catch (error) {
        logger.error('Erro ao iniciar serviço:', error);
        res.status(500).json({ error: 'Erro ao iniciar serviço', details: error.message });
    }
});

// POST /servicos/:id/stop
router.post('/servicos/:id/stop', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const result = await executeSSHCommand(
            service,
            `echo '${getSshPassword(service)}' | sudo -S bash -c 'cd ${getInstallPath(service)}/glassfish/bin && ./asadmin stop-domain ${getDomain(service)}'`,
            60000
        );

        if (result.code !== 0) throw new Error(result.stderr || 'Erro ao parar serviço');

        await service.update({ status: 'inactive' });
        await patchConfig(service, { pid: null });
        res.json({ message: 'Serviço parado com sucesso' });
    } catch (error) {
        logger.error('Erro ao parar serviço:', error);
        res.status(500).json({ error: 'Erro ao parar serviço', details: error.message });
    }
});

// POST /servicos/:id/restart
router.post('/servicos/:id/restart', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const result = await executeSSHCommand(
            service,
            `echo '${getSshPassword(service)}' | sudo -S bash -c 'cd ${getInstallPath(service)}/glassfish/bin && ./asadmin restart-domain ${getDomain(service)}'`,
            60000
        );

        if (result.code !== 0) throw new Error(result.stderr || 'Erro ao reiniciar serviço');

        await service.update({ status: 'active' });
        res.json({ message: 'Serviço reiniciado com sucesso' });
    } catch (error) {
        logger.error('Erro ao reiniciar serviço:', error);
        res.status(500).json({ error: 'Erro ao reiniciar serviço', details: error.message });
    }
});

// POST /servicos/:id/in-use — marca como em uso
router.post('/servicos/:id/in-use', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const inUseBy = req.body.user || req.body.inUseBy || 'Desconhecido';
        await patchConfig(service, { inUse: true, inUseBy });

        res.json({ message: 'Serviço marcado como em uso', inUseBy });
    } catch (error) {
        logger.error('Erro ao marcar serviço como em uso:', error);
        res.status(500).json({ error: 'Erro ao marcar serviço como em uso' });
    }
});

// POST /servicos/:id/available  (e alias /disponivel para compatibilidade)
async function markAvailableHandler(req, res) {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        await patchConfig(service, { inUse: false, inUseBy: '' });
        res.json({ message: 'Serviço marcado como disponível' });
    } catch (error) {
        logger.error('Erro ao marcar serviço como disponível:', error);
        res.status(500).json({ error: 'Erro ao marcar serviço como disponível' });
    }
}
router.post('/servicos/:id/available',   authMiddleware, markAvailableHandler);
router.post('/servicos/:id/disponivel',  authMiddleware, markAvailableHandler); // alias legado

// POST /servicos/:id/maintenance
router.post('/servicos/:id/maintenance', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const basePath = `${getInstallPath(service)}/glassfish/domains/${getDomain(service)}`;
        const results  = [];
        const tasks    = req.body.tasks || [];

        const dirMap = {
            cleanApplications: `${basePath}/applications`,
            cleanLogs:         `${basePath}/logs`,
            cleanGenerated:    `${basePath}/generated`,
            cleanAutodeploy:   `${basePath}/autodeploy`
        };

        for (const task of tasks) {
            const dir = dirMap[task];
            if (!dir) continue;

            const result = await executeSSHCommand(
                service,
                `echo '${getSshPassword(service)}' | sudo -S bash -c 'if [ -d "${dir}" ]; then rm -rf "${dir}"/* "${dir}"/.[!.]* 2>/dev/null || true && echo "OK"; else echo "DIR_NOT_FOUND"; exit 1; fi'`
            );

            results.push({
                task,
                success: result.code === 0,
                message: result.stdout || result.stderr
            });
        }

        res.json({ message: 'Manutenção executada', results });
    } catch (error) {
        logger.error('Erro na manutenção:', error);
        res.status(500).json({ error: 'Erro ao executar manutenção', details: error.message });
    }
});

// POST /servicos/:id/upload-application
router.post('/servicos/:id/upload-application', authMiddleware, upload.single('file'), async (req, res) => {
    let localFilePath = null;
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const autodeployPath = `${getInstallPath(service)}/glassfish/domains/${getDomain(service)}/autodeploy`;
        localFilePath = path.join(uploadsDir, req.file.originalname);
        await fs.promises.rename(req.file.path, localFilePath);

        const scp = new NodeSSH();
        await scp.connect({ host: service.ip || service.host, username: service.sshUsername || service.username, password: getSshPassword(service) });
        try {
            await scp.putFile(localFilePath, `/tmp/${req.file.originalname}`);
        } finally {
            scp.dispose();
        }

        const moveResult = await executeSSHCommand(
            service,
            `echo '${getSshPassword(service)}' | sudo -S bash -c 'rm -f "${autodeployPath}/${req.file.originalname}" && mv "/tmp/${req.file.originalname}" "${autodeployPath}/"'`
        );

        if (moveResult.code !== 0) throw new Error(moveResult.stderr || 'Erro ao mover arquivo');

        res.json({ message: 'Upload realizado com sucesso' });
    } catch (error) {
        logger.error('Erro no upload:', error);
        res.status(500).json({ error: 'Erro no upload', details: error.message });
    } finally {
        if (localFilePath && fs.existsSync(localFilePath)) {
            await fs.promises.unlink(localFilePath).catch(() => {});
        }
    }
});

// POST /test-ssh
router.post('/test-ssh', async (req, res) => {
    const { ip, username, password } = req.body;
    if (!ip || !username || !password)
        return res.status(400).json({ error: 'IP, usuário e senha são obrigatórios' });

    try {
        const ssh = new NodeSSH();
        await ssh.connect({ host: ip, username, password, readyTimeout: 5000 });
        const result = await ssh.execCommand('echo "SSH test successful"');
        ssh.dispose();
        res.json({ success: true, message: 'Conexão SSH estabelecida com sucesso', details: result.stdout });
    } catch (error) {
        let msg = 'Erro na conexão SSH';
        if (error.message.includes('ECONNREFUSED'))     msg = `Servidor ${ip} não está aceitando conexões SSH`;
        else if (error.message.includes('ETIMEDOUT'))   msg = `Timeout ao conectar com ${ip}`;
        else if (error.message.includes('Authentication failed')) msg = `Falha na autenticação para ${ip}`;
        res.status(500).json({ success: false, error: msg, details: error.message });
    }
});

module.exports = router;