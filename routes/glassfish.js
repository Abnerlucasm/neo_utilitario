const express  = require('express');
const router   = express.Router();
const { NodeSSH } = require('node-ssh');
const fs       = require('fs');
const path     = require('path');
const multer   = require('multer');
const FormData = require('form-data');
const fetch    = require('node-fetch'); // node-fetch v2 ou nativo Node 18+
const https    = require('https');

// Agente HTTPS que aceita certificados autoassinados do GlassFish
// O GlassFish usa HTTPS com self-signed cert na porta 4848
const gfAgent = new https.Agent({ rejectUnauthorized: false });
const { Glassfish } = require('../models/postgresql/associations');
const authMiddleware = require('../middlewares/auth');
const logger   = require('../utils/logger');

// ─── Upload config ─────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename:    (req, file, cb) => cb(null, file.originalname)
    }),
    limits: { fileSize: 500 * 1024 * 1024 }
});

// ─── Middleware de log ─────────────────────────────────────────────────────────
router.use((req, res, next) => {
    logger.info(`[Glassfish] ${req.method} ${req.url}`);
    next();
});

// ─── expandService: expande config JSONB para o frontend ──────────────────────
function expandService(s) {
    const base = s.toJSON ? s.toJSON() : s;
    const cfg  = base.config || {};
    return {
        ...base,
        ip:              base.host,
        sshUsername:     base.username,
        sshPassword:     cfg.sshPassword     || base.password || '',
        adminPassword:   cfg.adminPassword   || 'admin',
        installPath:     cfg.installPath     || '/srv/glassfish6.2.5',
        setor:           cfg.setor           || '',
        accessType:      cfg.accessType      || 'local',
        productionPort:  cfg.productionPort  || 8091,
        inUse:           cfg.inUse           || false,
        inUseBy:         cfg.inUseBy         || '',
        machineStatus:   cfg.machineStatus   || 'unknown',
        glassfishStatus: cfg.glassfishStatus || (base.status === 'active' ? 'active' : 'inactive'),
    };
}

// ─── patchConfig: salva campos no JSONB sem sobrescrever os demais ─────────────
async function patchConfig(service, patch) {
    service.config = { ...(service.config || {}), ...patch };
    service.changed('config', true);
    await service.save();
}

// ─── Helpers para campos com fallback ─────────────────────────────────────────
const getInstallPath  = s => (s.installPath || s.config?.installPath || '/srv/glassfish6.2.5').replace(/\/$/, '');
const getDomain       = s => s.domain || 'domain1';
const getSshPassword  = s => s.sshPassword || s.config?.sshPassword || s.password || '';
const getAdminPass    = s => s.adminPassword || s.config?.adminPassword || 'admin';

// ─── API REST do GlassFish ─────────────────────────────────────────────────────
/**
 * Faz uma chamada à API REST administrativa do GlassFish.
 * Usa autenticação HTTP Basic com o usuário admin.
 *
 * @param {object} service  - registro do banco com ip, port, adminPassword
 * @param {string} method   - GET | POST | PUT | DELETE
 * @param {string} endpoint - caminho após /management/domain  ex: '/applications'
 * @param {object|null} body - objeto JSON para o body (opcional)
 * @param {number} timeout  - timeout em ms
 */
async function gfAPI(service, method, endpoint, body = null, timeout = 15000) {
    const base = `https://${service.ip}:${service.port}/management/domain`;
    const url  = `${base}${endpoint}`;
    const auth = Buffer.from(`admin:${getAdminPass(service)}`).toString('base64');

    const headers = {
        'Authorization': `Basic ${auth}`,
        'Accept':        'application/json',
        'X-Requested-By': 'GlassFish REST HTML interface',
    };
    if (body) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(url, {
            method,
            headers,
            body:   body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
            agent:  gfAgent,       // aceita certificado autoassinado do GlassFish
        });

        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { message: text }; }

        if (!res.ok) {
            const msg = data?.message || data?.exit_code || `HTTP ${res.status}`;
            throw new Error(msg);
        }

        return data;
    } catch (err) {
        if (err.name === 'AbortError') throw new Error(`Timeout ao conectar com ${service.ip}:${service.port}`);
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Verifica se o GlassFish está respondendo na API REST.
 * Retorna true/false sem lançar exceção.
 */
async function isGlassfishReachable(service) {
    try {
        await gfAPI(service, 'GET', '', null, 5000);
        return true;
    } catch {
        return false;
    }
}

// ─── SSH: usado apenas para start-domain e manutenção de diretórios ───────────
async function executeSSHCommand(service, command, timeout = 30000) {
    const ssh = new NodeSSH();
    try {
        await ssh.connect({
            host:              service.ip,
            username:          service.sshUsername || service.username,
            password:          getSshPassword(service),
            readyTimeout:      timeout,
            keepaliveInterval: 10000,
        });

        const result = await ssh.execCommand(command, { cwd: '/', timeout: 25000 });
        return { code: result.code || 0, stdout: result.stdout || '', stderr: result.stderr || '' };
    } catch (err) {
        if (err.message.includes('ECONNREFUSED')) throw new Error(`SSH recusado em ${service.ip}`);
        if (err.message.includes('ETIMEDOUT'))    throw new Error(`SSH timeout em ${service.ip}`);
        if (err.message.includes('Authentication failed')) throw new Error(`Falha de autenticação SSH em ${service.ip}`);
        throw err;
    } finally {
        ssh.dispose();
    }
}

// ─── CRUD dos servidores ───────────────────────────────────────────────────────

// GET /servicos
router.get('/servicos', authMiddleware, async (req, res) => {
    try {
        const servers = await Glassfish.findAll({ order: [['name', 'ASC']] });
        res.json(servers.map(expandService));
    } catch (err) {
        logger.error('Erro ao listar servidores:', err);
        res.status(500).json({ error: 'Erro ao listar servidores' });
    }
});

// POST /servicos
router.post('/servicos', authMiddleware, async (req, res) => {
    try {
        const b = req.body;
        if (!b.name || !b.ip || !b.domain || !b.sshUsername || !b.sshPassword || !b.installPath) {
            return res.status(400).json({ error: 'Campos obrigatórios: name, ip, domain, sshUsername, sshPassword, installPath' });
        }

        const server = await Glassfish.create({
            name:     b.name,
            host:     b.ip,
            port:     parseInt(b.port) || 4848,
            username: b.sshUsername,
            password: b.sshPassword,
            domain:   b.domain,
            status:   'inactive',
            config: {
                sshPassword:    b.sshPassword,
                adminPassword:  b.adminPassword  || 'admin',
                installPath:    b.installPath    || '/srv/glassfish6.2.5',
                productionPort: parseInt(b.productionPort) || 8091,
                setor:          b.setor          || '',
                accessType:     b.accessType     || 'local',
                inUse:          false,
                inUseBy:        '',
            }
        });

        res.status(201).json(expandService(server));
    } catch (err) {
        logger.error('Erro ao criar servidor:', err);
        res.status(500).json({ error: 'Erro ao criar servidor', details: err.message });
    }
});

// PUT /servicos/:id
router.put('/servicos/:id', authMiddleware, async (req, res) => {
    try {
        const server = await Glassfish.findByPk(req.params.id);
        if (!server) return res.status(404).json({ error: 'Servidor não encontrado' });

        const b = req.body;
        const updatedConfig = {
            ...(server.config || {}),
            sshPassword:    b.sshPassword    || getSshPassword(server),
            adminPassword:  b.adminPassword  || getAdminPass(server),
            installPath:    b.installPath    || getInstallPath(server),
            productionPort: parseInt(b.productionPort) || server.config?.productionPort || 8091,
            setor:          b.setor          !== undefined ? b.setor   : (server.config?.setor || ''),
            accessType:     b.accessType     || server.config?.accessType || 'local',
        };

        await server.update({
            name:     b.name       || server.name,
            host:     b.ip         || server.host,
            port:     parseInt(b.port) || server.port,
            username: b.sshUsername || server.username,
            password: b.sshPassword || server.password,
            domain:   b.domain     || server.domain,
            config:   updatedConfig
        });

        await server.reload();
        res.json(expandService(server));
    } catch (err) {
        logger.error('Erro ao atualizar servidor:', err);
        res.status(500).json({ error: 'Erro ao atualizar servidor', details: err.message });
    }
});

// DELETE /servicos/:id
router.delete('/servicos/:id', authMiddleware, async (req, res) => {
    try {
        const server = await Glassfish.findByPk(req.params.id);
        if (!server) return res.status(404).json({ error: 'Servidor não encontrado' });
        await server.destroy();
        res.status(204).send();
    } catch (err) {
        logger.error('Erro ao excluir servidor:', err);
        res.status(500).json({ error: 'Erro ao excluir servidor' });
    }
});

// ─── Status (via API REST, sem SSH) ───────────────────────────────────────────
router.get('/servicos/:id/status', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        // ── 1. Verificar se a MÁQUINA está acessível (ping SSH) ──────────────
        let machineStatus = 'offline';
        try {
            const ssh = new NodeSSH();
            await ssh.connect({
                host:         service.ip,
                username:     service.username,
                password:     getSshPassword(service),
                readyTimeout: 5000,
            });
            await ssh.execCommand('echo ok');
            ssh.dispose();
            machineStatus = 'online';
        } catch {
            machineStatus = 'offline';
        }

        // ── 2. Verificar se o GLASSFISH está respondendo (API REST) ──────────
        let glassfishStatus = machineStatus === 'offline' ? 'unknown' : 'inactive';

        if (machineStatus === 'online') {
            const reachable = await isGlassfishReachable(service);
            if (reachable) {
                glassfishStatus = 'active';
            } else {
                glassfishStatus = 'inactive';
            }
        }

        // ── 3. Persistir os dois estados ──────────────────────────────────────
        // status na coluna principal = glassfishStatus (compatibilidade)
        const colStatus = glassfishStatus === 'active' ? 'active' : 'inactive';
        await service.update({ status: colStatus });
        await patchConfig(service, { machineStatus, glassfishStatus });

        res.json({ machineStatus, glassfishStatus, status: colStatus });

    } catch (err) {
        logger.error('Erro ao verificar status:', err);
        res.status(500).json({ error: 'Erro ao verificar status', details: err.message });
    }
});

// ─── Logs (via API REST — GET /management/domain/view-log) ────────────────────
// O GlassFish retorna o arquivo de log como texto plano.
// O header X-Text-Append-Next contém a URL para buscar apenas as linhas novas.
router.get('/servicos/:id/logs', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const base = `https://${service.ip}:${service.port}/management/domain`;
        const auth = Buffer.from(`admin:${getAdminPass(service)}`).toString('base64');

        // Pegar as últimas linhas usando o parâmetro start=-50000 (bytes do fim)
        // view-log retorna texto plano — não JSON
        const logRes = await fetch(`${base}/view-log`, {
            headers: {
                'Authorization':  `Basic ${auth}`,
                'X-Requested-By': 'GlassFish REST HTML interface',
                'Accept':         '*/*',
            },
            agent: gfAgent,
        });

        if (!logRes.ok) {
            return res.status(500).json({
                error: 'Erro ao obter logs',
                details: `HTTP ${logRes.status} em ${base}/view-log`
            });
        }

        const logText = await logRes.text();
        // Retornar as últimas 200 linhas
        const lines = logText.split('\n');
        const last200 = lines.slice(-200).join('\n');

        // Passar o header X-Text-Append-Next para o cliente fazer polling incremental
        const appendNext = logRes.headers.get('X-Text-Append-Next');

        res.json({
            logs:           last200,
            appendNextUrl:  appendNext || null,
        });
    } catch (err) {
        logger.error('Erro ao obter logs:', err);
        res.status(500).json({ error: 'Erro ao obter logs', details: err.message });
    }
});

// ─── Logs incrementais (polling nativo via X-Text-Append-Next) ───────────────
// O frontend passa o appendNextUrl e recebe apenas as linhas novas
router.get('/servicos/:id/logs/since', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const appendNextUrl = req.query.url;
        if (!appendNextUrl) return res.json({ logs: '', appendNextUrl: null });

        const auth = Buffer.from(`admin:${getAdminPass(service)}`).toString('base64');

        const logRes = await fetch(appendNextUrl, {
            headers: {
                'Authorization':  `Basic ${auth}`,
                'X-Requested-By': 'GlassFish REST HTML interface',
                'Accept':         '*/*',
            },
            agent: gfAgent,
        });

        const logText   = logRes.ok ? await logRes.text() : '';
        const appendNext = logRes.headers.get('X-Text-Append-Next');

        res.json({ logs: logText, appendNextUrl: appendNext || null });
    } catch (err) {
        res.json({ logs: '', appendNextUrl: null });
    }
});

// ─── Start (SSH — único caso obrigatório) ─────────────────────────────────────
router.post('/servicos/:id/start', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const result = await executeSSHCommand(
            service,
            `${getInstallPath(service)}/glassfish/bin/asadmin start-domain ${getDomain(service)}`
        );

        if (result.code !== 0 && !result.stdout.includes('successfully')) {
            throw new Error(result.stderr || result.stdout || 'Erro ao iniciar serviço');
        }

        await service.update({ status: 'active' });
        res.json({ message: 'Serviço iniciado com sucesso' });
    } catch (err) {
        logger.error('Erro ao iniciar serviço:', err);
        res.status(500).json({ error: 'Erro ao iniciar serviço', details: err.message });
    }
});

// ─── Stop (via API REST) ───────────────────────────────────────────────────────
router.post('/servicos/:id/stop', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        // POST /management/domain/stop — GlassFish 6 suporta este endpoint
        await gfAPI(service, 'POST', '/stop', {}, 30000);

        await service.update({ status: 'inactive' });
        res.json({ message: 'Serviço parado com sucesso' });
    } catch (err) {
        logger.error('Erro ao parar serviço:', err);
        res.status(500).json({ error: 'Erro ao parar serviço', details: err.message });
    }
});

// ─── Restart (via API REST) ────────────────────────────────────────────────────
router.post('/servicos/:id/restart', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        // POST /management/domain/restart
        await gfAPI(service, 'POST', '/restart', {}, 60000);

        await service.update({ status: 'active' });
        res.json({ message: 'Serviço reiniciado com sucesso' });
    } catch (err) {
        logger.error('Erro ao reiniciar serviço:', err);
        res.status(500).json({ error: 'Erro ao reiniciar serviço', details: err.message });
    }
});

// ─── Configuração do pool de BD (via API REST — sem editar domain.xml) ────────
router.get('/servicos/:id/domain-config', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const data = await gfAPI(
            service,
            'GET',
            '/resources/jdbc-connection-pool/Pg_Neocorp_Pool'
        );

        // Extrair as propriedades do pool
        const props   = data?.extraProperties?.entity || {};
        const propList = data?.extraProperties?.properties || {};

        const config = {
            serverName:   propList.serverName   || props.serverName   || '',
            user:         propList.user         || props.user         || '',
            password:     propList.password     || props.password     || '',
            databaseName: propList.databaseName || props.databaseName || '',
        };

        res.json(config);
    } catch (err) {
        logger.error('Erro ao ler configurações:', err);
        res.status(500).json({ error: 'Erro ao ler configurações', details: err.message });
    }
});

// ─── Salvar configurações do pool (via API REST — sem sudo, sem editar XML) ───
router.put('/servicos/:id/domain-config', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const { serverName, user, password, databaseName } = req.body;

        // POST com application/x-www-form-urlencoded para atualizar propriedades do pool
        const base = `https://${service.ip}:${service.port}/management/domain`;
        const auth = Buffer.from(`admin:${getAdminPass(service)}`).toString('base64');

        const params = new URLSearchParams();
        params.append('serverName',   serverName   || '');
        params.append('user',         user         || '');
        params.append('password',     password     || '');
        params.append('databaseName', databaseName || '');

        const poolRes = await fetch(
            `${base}/resources/jdbc-connection-pool/Pg_Neocorp_Pool/property`,
            {
                method:  'POST',
                headers: {
                    'Authorization':   `Basic ${auth}`,
                    'X-Requested-By':  'GlassFish REST HTML interface',
                    'Content-Type':    'application/x-www-form-urlencoded',
                    'Accept':          'application/json',
                },
                body:  params.toString(),
                agent: gfAgent,
            }
        );

        if (!poolRes.ok) {
            const err = await poolRes.json().catch(() => ({}));
            throw new Error(err.message || `HTTP ${poolRes.status}`);
        }

        res.json({ message: 'Configurações atualizadas com sucesso' });
    } catch (err) {
        logger.error('Erro ao salvar configurações:', err);
        res.status(500).json({ error: 'Erro ao salvar configurações', details: err.message });
    }
});

// ─── Listar aplicações (via API REST) ─────────────────────────────────────────
router.get('/servicos/:id/applications', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const data = await gfAPI(service, 'GET', '/applications');
        const childResources = data?.extraProperties?.childResources || {};

        const applications = Object.entries(childResources).map(([name, url]) => ({
            name,
            status:  'deployed',
            enabled: true,
            url,
        }));

        res.json({ status: 'success', applications });
    } catch (err) {
        logger.error('Erro ao listar aplicações:', err);
        res.status(500).json({ error: 'Erro ao listar aplicações', details: err.message });
    }
});

// ─── Upload/deploy de aplicação (via API REST multipart) ─────────────────────
router.post('/servicos/:id/upload-application', authMiddleware, upload.single('file'), async (req, res) => {
    let localFilePath = null;
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        localFilePath = path.join(uploadsDir, req.file.originalname);
        await fs.promises.rename(req.file.path, localFilePath);

        const base = `https://${service.ip}:${service.port}/management/domain`;
        const auth = Buffer.from(`admin:${getAdminPass(service)}`).toString('base64');

        const form = new FormData();
        form.append('id', fs.createReadStream(localFilePath), {
            filename: req.file.originalname,
        });
        form.append('force', 'true');

        const deployRes = await fetch(`${base}/applications/application`, {
            method:  'POST',
            headers: {
                'Authorization':  `Basic ${auth}`,
                'X-Requested-By': 'GlassFish REST HTML interface',
                ...form.getHeaders(),
            },
            body:  form,
            agent: gfAgent,
        });

        if (!deployRes.ok) {
            const err = await deployRes.json().catch(() => ({}));
            throw new Error(err.message || `Deploy falhou: HTTP ${deployRes.status}`);
        }

        res.json({ message: 'Deploy realizado com sucesso' });
    } catch (err) {
        logger.error('Erro no deploy:', err);
        res.status(500).json({ error: 'Erro no deploy', details: err.message });
    } finally {
        if (localFilePath) await fs.promises.unlink(localFilePath).catch(() => {});
    }
});

// ─── Testar conexão SSH ────────────────────────────────────────────────────────
router.post('/test-ssh', async (req, res) => {
    const { ip, username, password } = req.body;
    if (!ip || !username || !password)
        return res.status(400).json({ error: 'IP, usuário e senha são obrigatórios' });

    try {
        const ssh = new NodeSSH();
        await ssh.connect({ host: ip, username, password, readyTimeout: 5000 });
        const result = await ssh.execCommand('echo "ok"');
        ssh.dispose();
        res.json({ success: true, message: 'Conexão SSH estabelecida com sucesso', details: result.stdout });
    } catch (err) {
        let msg = 'Erro na conexão SSH';
        if (err.message.includes('ECONNREFUSED'))        msg = `Servidor ${ip} não aceita conexões SSH`;
        else if (err.message.includes('ETIMEDOUT'))      msg = `Timeout ao conectar com ${ip}`;
        else if (err.message.includes('Authentication')) msg = `Falha de autenticação SSH para ${ip}`;
        res.status(500).json({ success: false, error: msg, details: err.message });
    }
});

// ─── Testar conexão com API REST do GlassFish ─────────────────────────────────
router.post('/test-api', async (req, res) => {
    const { ip, port, adminPassword } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP é obrigatório' });

    const mockService = { ip, port: parseInt(port) || 4848, config: { adminPassword: adminPassword || 'admin' } };
    try {
        const data = await gfAPI(mockService, 'GET', '', null, 5000);
        res.json({ success: true, message: 'API REST do GlassFish acessível', version: data?.extraProperties?.version || '' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Marcar em uso ─────────────────────────────────────────────────────────────
router.post('/servicos/:id/in-use', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });
        const inUseBy = req.body.user || req.body.inUseBy || 'Desconhecido';
        await patchConfig(service, { inUse: true, inUseBy });
        res.json({ message: 'Serviço marcado como em uso', inUseBy });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao marcar serviço como em uso' });
    }
});

// ─── Marcar disponível (com proteção de dono) ─────────────────────────────────
async function markAvailableHandler(req, res) {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const cfg       = service.config || {};
        const requester = req.user?.email || req.user?.username || '';
        const isAdmin   = req.user?.is_admin || req.user?.roles?.some(r => r === 'admin' || r?.name === 'admin');

        if (cfg.inUse && cfg.inUseBy && !isAdmin) {
            const reqBase   = requester.split('@')[0].toLowerCase();
            const ownerBase = cfg.inUseBy.split('@')[0].toLowerCase();
            if (reqBase !== ownerBase) {
                return res.status(403).json({
                    error: `Em uso por "${cfg.inUseBy}". Apenas o próprio usuário ou um admin pode liberar.`
                });
            }
        }

        await patchConfig(service, { inUse: false, inUseBy: '' });
        res.json({ message: 'Serviço marcado como disponível' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao marcar serviço como disponível' });
    }
}
router.post('/servicos/:id/available',  authMiddleware, markAvailableHandler);
router.post('/servicos/:id/disponivel', authMiddleware, markAvailableHandler);

// ─── Manutenção de diretórios (SSH — necessário para acesso ao filesystem) ────
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
            cleanAutodeploy:   `${basePath}/autodeploy`,
        };

        for (const task of tasks) {
            const dir = dirMap[task];
            if (!dir) continue;
            const result = await executeSSHCommand(
                service,
                `rm -rf "${dir}"/* "${dir}"/.[!.]* 2>/dev/null; echo "OK"`
            );
            results.push({ task, success: result.code === 0, message: result.stdout || result.stderr });
        }

        res.json({ message: 'Manutenção executada', results });
    } catch (err) {
        logger.error('Erro na manutenção:', err);
        res.status(500).json({ error: 'Erro ao executar manutenção', details: err.message });
    }
});

// ─── Stats ─────────────────────────────────────────────────────────────────────
router.get('/servicos/stats/overview', authMiddleware, async (req, res) => {
    try {
        const servers = await Glassfish.findAll();
        res.json({
            total:    servers.length,
            active:   servers.filter(s => s.status === 'active').length,
            inactive: servers.filter(s => s.status !== 'active').length,
        });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao obter estatísticas' });
    }
});

module.exports = router;