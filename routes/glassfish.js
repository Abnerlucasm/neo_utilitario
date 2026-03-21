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
const { Glassfish, GlassfishCategory } = require('../models/postgresql/associations');
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

// ─── Rotas de Categorias ─────────────────────────────────────────────────────

// GET /categorias — lista todas as categorias
router.get('/categorias', authMiddleware, async (req, res) => {
    try {
        const cats = await GlassfishCategory.findAll({
            where: { active: true },
            order: [['name', 'ASC']]
        });
        res.json(cats);
    } catch (err) {
        logger.error('Erro ao listar categorias:', err);
        res.status(500).json({ error: 'Erro ao listar categorias' });
    }
});

// GET /categorias/all — lista todas incluindo inativas (admin)
router.get('/categorias/all', authMiddleware, async (req, res) => {
    try {
        const cats = await GlassfishCategory.findAll({ order: [['name', 'ASC']] });
        res.json(cats);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar categorias' });
    }
});

// POST /categorias
router.post('/categorias', authMiddleware, async (req, res) => {
    try {
        const { name, description, color } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
        const cat = await GlassfishCategory.create({
            name: name.trim(),
            description: description?.trim() || null,
            color: color || '#6b7280'
        });
        res.status(201).json(cat);
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ error: 'Já existe uma categoria com esse nome' });
        }
        res.status(500).json({ error: 'Erro ao criar categoria', details: err.message });
    }
});

// PUT /categorias/:id
router.put('/categorias/:id', authMiddleware, async (req, res) => {
    try {
        const cat = await GlassfishCategory.findByPk(req.params.id);
        if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });
        const { name, description, color, active } = req.body;
        await cat.update({
            name:        name?.trim()        || cat.name,
            description: description?.trim() ?? cat.description,
            color:       color               || cat.color,
            active:      active !== undefined ? active : cat.active,
        });
        res.json(cat);
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ error: 'Já existe uma categoria com esse nome' });
        }
        res.status(500).json({ error: 'Erro ao atualizar categoria', details: err.message });
    }
});

// DELETE /categorias/:id
router.delete('/categorias/:id', authMiddleware, async (req, res) => {
    try {
        const cat = await GlassfishCategory.findByPk(req.params.id);
        if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });
        // Soft delete — só desativa para não quebrar registros existentes
        await cat.update({ active: false });
        res.json({ message: 'Categoria desativada com sucesso' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao remover categoria' });
    }
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
        productionPort:  cfg.productionPort  || 8080,
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
                productionPort: parseInt(b.productionPort) || 8080,
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
            productionPort: parseInt(b.productionPort) || server.config?.productionPort || 8080,
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

        const base = `https://${service.ip}:${service.port}/management/domain`;
        const auth  = Buffer.from(`admin:${getAdminPass(service)}`).toString('base64');
        const headers = {
            'Authorization':  `Basic ${auth}`,
            'Accept':         'application/json',
            'X-Requested-By': 'GlassFish REST HTML interface',
        };

        // GET /property retorna as propriedades reais do pool (serverName, user, etc.)
        // formato: { extraProperties: { properties: { serverName: "...", user: "..." } } }
        // ou lista: { extraProperties: { properties: [ {name:"serverName", value:"..."}, ... ] } }
        const propUrl  = `${base}/resources/jdbc-connection-pool/Pg_Neocorp_Pool/property`;
        logger.info('[domain-config] Chamando:', propUrl);

        const propRes  = await fetch(propUrl, { headers, agent: gfAgent });
        const propText = await propRes.text();

        logger.info('[domain-config] HTTP status (property):', propRes.status);
        logger.info('[domain-config] Resposta bruta (2000 chars):', propText.slice(0, 2000));

        if (!propRes.ok) {
            return res.status(500).json({
                error: 'Erro ao ler propriedades do pool',
                details: `HTTP ${propRes.status}: ${propText.slice(0, 300)}`
            });
        }

        let propData;
        try { propData = JSON.parse(propText); } catch {
            return res.status(500).json({ error: 'Resposta inválida do GlassFish', details: propText.slice(0, 300) });
        }

        logger.info('[domain-config] extraProperties keys:', Object.keys(propData?.extraProperties || {}));

        const rawProps = propData?.extraProperties?.properties || {};
        logger.info('[domain-config] rawProps type:', typeof rawProps, Array.isArray(rawProps) ? 'array' : 'object');
        logger.info('[domain-config] rawProps:', JSON.stringify(rawProps, null, 2).slice(0, 1000));

        // O GlassFish pode retornar properties como:
        //   Objeto: { serverName: "...", user: "..." }
        //   Array:  [ { name: "serverName", value: "..." }, ... ]
        const getProp = (name) => {
            if (Array.isArray(rawProps)) {
                const item = rawProps.find(p => p.name === name);
                return item?.value || '';
            }
            const val = rawProps[name];
            if (val === undefined || val === null) return '';
            return typeof val === 'object' ? (val.value || '') : String(val);
        };

        const config = {
            serverName:   getProp('serverName'),
            user:         getProp('user'),
            password:     getProp('password'),
            databaseName: getProp('databaseName'),
        };

        logger.info('[domain-config] Config extraído:', config);
        res.json(config);
    } catch (err) {
        logger.error('[domain-config] Erro:', err.message);
        res.status(500).json({ error: 'Erro ao ler configurações', details: err.message });
    }
});

// ─── Salvar configurações do pool (via API REST — sem sudo, sem editar XML) ───
router.put('/servicos/:id/domain-config', authMiddleware, async (req, res) => {
    try {
        const service = await Glassfish.findByPk(req.params.id);
        if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

        const { serverName, user, password, databaseName, restartAfterSave } = req.body;

        const base = `https://${service.ip}:${service.port}/management/domain`;
        const auth = Buffer.from(`admin:${getAdminPass(service)}`).toString('base64');

        // O GlassFish aceita as propriedades como JSON no corpo
        // Cada propriedade é um objeto { name, value }
        const properties = [
            { name: 'serverName',   value: serverName   || '' },
            { name: 'user',         value: user         || '' },
            { name: 'password',     value: password     || '' },
            { name: 'databaseName', value: databaseName || '' },
        ];

        // Tentar primeiro com JSON (GlassFish 6)
        let saveOk = false;
        try {
            const jsonRes = await fetch(
                `${base}/resources/jdbc-connection-pool/Pg_Neocorp_Pool/property`,
                {
                    method:  'POST',
                    headers: {
                        'Authorization':  `Basic ${auth}`,
                        'X-Requested-By': 'GlassFish REST HTML interface',
                        'Content-Type':   'application/json',
                        'Accept':         'application/json',
                    },
                    body:  JSON.stringify({ property: properties }),
                    agent: gfAgent,
                }
            );
            if (jsonRes.ok) saveOk = true;
        } catch { /* ignorado, tentará form-urlencoded */ }

        // Fallback: form-urlencoded
        if (!saveOk) {
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
                throw new Error(err.message || `HTTP ${poolRes.status} ao salvar pool`);
            }
            saveOk = true;
        }

        // ── Restart automático se solicitado ──────────────────────────────────
        // Alterar propriedades do pool JDBC requer restart do GlassFish
        if (restartAfterSave) {
            try {
                await gfAPI(service, 'POST', '/restart', {}, 60000);
                await service.update({ status: 'active' });
                logger.info(`GlassFish reiniciado após salvar domain-config para ${service.name}`);
                return res.json({
                    message: 'Configurações salvas e servidor reiniciado com sucesso',
                    restarted: true
                });
            } catch (restartErr) {
                logger.warn('Configurações salvas mas restart falhou:', restartErr.message);
                return res.json({
                    message: 'Configurações salvas. Reiniciar o servidor manualmente para aplicar.',
                    restarted: false,
                    restartError: restartErr.message
                });
            }
        }

        res.json({ message: 'Configurações salvas. Reinicie o servidor para aplicar.', restarted: false });
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

        // Log bruto completo para diagnóstico definitivo
        const rawA = await gfAPI(service, 'GET', '/applications').catch(e => ({ _error: e.message }));
        const rawB = await gfAPI(service, 'GET', '/applications/application').catch(e => ({ _error: e.message }));

        logger.info('[applications] FULL /applications:', JSON.stringify(rawA, null, 2).slice(0, 3000));
        logger.info('[applications] FULL /applications/application:', JSON.stringify(rawB, null, 2).slice(0, 3000));

        const applications = [];

        // Tentar extrair de /applications/application primeiro, depois /applications
        const extractApps = (data, sourceLabel) => {
            if (!data || data._error) return;

            const childResources = data?.extraProperties?.childResources || {};
            const entity         = data?.extraProperties?.entity;

            // childResources como objeto { nome: url }
            if (Object.keys(childResources).length > 0) {
                for (const [name, url] of Object.entries(childResources)) {
                    // Pular entradas que claramente são sub-rotas e não aplicações
                    if (!name || name === 'application' || name === 'lifecycle' || name === '__asadmin') continue;
                    if (applications.find(a => a.name === name)) continue; // evitar duplicatas

                    logger.info(`[applications][${sourceLabel}] found:`, name);
                    applications.push({ name, enabled: true, status: 'deployed', fileName: '', location: '', url });
                }
            }

            // entity como array de aplicações
            if (Array.isArray(entity)) {
                entity.forEach(app => {
                    const name = app.name || String(app);
                    if (!name || applications.find(a => a.name === name)) return;
                    logger.info(`[applications][${sourceLabel}] entity found:`, name);
                    const location = app.location || '';
                    applications.push({
                        name,
                        enabled:  app.enabled !== 'false' && app.enabled !== false,
                        status:   'deployed',
                        fileName: location ? location.replace(/^file:/, '').split('/').pop() : '',
                        location,
                        appType:  app['object-type'] || '',
                    });
                });
            }

            // entity como objeto único (uma só app)
            if (entity && typeof entity === 'object' && !Array.isArray(entity) && entity.name) {
                if (!applications.find(a => a.name === entity.name)) {
                    const location = entity.location || '';
                    logger.info(`[applications][${sourceLabel}] single entity:`, entity.name);
                    applications.push({
                        name:     entity.name,
                        enabled:  entity.enabled !== 'false' && entity.enabled !== false,
                        status:   'deployed',
                        fileName: location ? location.replace(/^file:/, '').split('/').pop() : '',
                        location,
                        appType:  entity['object-type'] || '',
                    });
                }
            }
        };

        extractApps(rawB, '/application');
        extractApps(rawA, '/applications');

        // Buscar detalhes (fileName, location) para apps que ainda não têm
        for (const app of applications) {
            if (app.fileName || app.location) continue;
            try {
                const detail  = await gfAPI(service, 'GET', `/applications/application/${app.name}`);
                const entity  = detail?.extraProperties?.entity || {};
                const location = entity.location || entity['archive-name'] || '';
                app.enabled   = entity.enabled !== 'false' && entity.enabled !== false;
                app.location  = location;
                app.appType   = entity['object-type'] || '';
                app.fileName  = location ? location.replace(/^file:/, '').split('/').pop() : '';
                logger.info(`[applications] detail ${app.name}:`, { location, fileName: app.fileName });
            } catch (e) {
                logger.warn(`[applications] sem detalhe para ${app.name}:`, e.message);
            }
        }

        logger.info('[applications] total encontradas:', applications.length, applications.map(a => a.name));

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


// ─── Telemetria (SSH sistema + API REST GlassFish JVM) ────────────────────────
router.get('/servicos/:id/telemetry', authMiddleware, async (req, res) => {
    const service = await Glassfish.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

    const result = { machine: null, jvm: null, errors: [] };

    // ── 1. Métricas do sistema via SSH (uma conexão por comando) ─────────────
    try {
        const ssh = async (cmd, timeout = 8000) => {
            try {
                const r = await executeSSHCommand(service, cmd, timeout);
                return (r.stdout || '').trim();
            } catch (e) {
                logger.warn('[telemetry] cmd falhou:', cmd.slice(0,40), e.message);
                return '';
            }
        };

        // Executar tudo em paralelo — cada um tem sua própria conexão SSH
        const [ramRaw, cpu1Raw, diskRaw, uptimeRaw, loadRaw] = await Promise.all([
            ssh("free -m | awk 'NR==2{print $2, $3, $4}'"),
            ssh("awk 'NR==1{print $2+$3+$4+$5+$6+$7+$8, $5}' /proc/stat; sleep 1; awk 'NR==1{print $2+$3+$4+$5+$6+$7+$8, $5}' /proc/stat", 10000),
            ssh("df / | awk 'NR==2{print $2, $3, $4, $5}'"),
            ssh('uptime -p 2>/dev/null || echo unknown'),
            ssh("awk '{print $1, $2, $3}' /proc/loadavg"),
        ]);

        logger.info('[telemetry] raw:', { ramRaw, cpu1Raw: cpu1Raw.slice(0,80), diskRaw, uptimeRaw, loadRaw });

        // RAM
        const rp      = ramRaw.split(/\s+/);
        const ramTotal = parseInt(rp[0]) || 0;
        const ramUsed  = parseInt(rp[1]) || 0;
        const ramFree  = parseInt(rp[2]) || 0;
        const ramPct   = ramTotal > 0 ? Math.round(ramUsed * 100 / ramTotal) : 0;

        // CPU — duas linhas "total idle"
        let cpuPct = 0;
        const cpuLines = cpu1Raw.split('\n').map(l => l.trim()).filter(Boolean);
        if (cpuLines.length >= 2) {
            const [t1, i1] = cpuLines[0].split(/\s+/).map(Number);
            const [t2, i2] = cpuLines[1].split(/\s+/).map(Number);
            const dt = t2 - t1, di = i2 - i1;
            if (dt > 0) cpuPct = Math.round((dt - di) * 100 / dt);
        }

        // Disco — df sem -h retorna 1K-blocks, converter para GB
        const dp      = diskRaw.split(/\s+/);
        const toGB    = v => v ? (Math.round(parseInt(v) / 1024 / 1024 * 10) / 10) + ' GB' : '?';
        const diskPct = parseInt((dp[3] || '0').replace('%', '')) || 0;

        result.machine = {
            ram:    { total: ramTotal, used: ramUsed, free: ramFree, percent: ramPct, unit: 'MB' },
            cpu:    { percent: cpuPct },
            disk:   { total: toGB(dp[0]), used: toGB(dp[1]), free: toGB(dp[2]), percent: diskPct },
            uptime: uptimeRaw || '?',
            load:   loadRaw   || '?',
        };

    } catch (err) {
        logger.warn('[telemetry] SSH erro geral:', err.message);
        result.errors.push('SSH: ' + err.message);
    }

    // ── 2. Métricas JVM via API REST GlassFish ────────────────────────────────
    try {
        // Buscar sub-nós específicos em paralelo — /jvm retorna só childResources
        const [memData, threadData, runtimeData] = await Promise.all([
            gfAPI(service, 'GET', '/monitoring/domain/server/jvm/memory',  null, 8000).catch(() => null),
            gfAPI(service, 'GET', '/monitoring/domain/server/jvm/thread-system', null, 8000).catch(() => null),
            gfAPI(service, 'GET', '/monitoring/domain/server/jvm/runtime', null, 8000).catch(() => null),
        ]);

        logger.info('[telemetry] JVM memory entity keys:', Object.keys(memData?.extraProperties?.entity || {}));
        logger.info('[telemetry] JVM thread entity keys:', Object.keys(threadData?.extraProperties?.entity || {}));
        logger.info('[telemetry] JVM runtime entity keys:', Object.keys(runtimeData?.extraProperties?.entity || {}));

        const mem     = memData?.extraProperties?.entity     || {};
        const threads = threadData?.extraProperties?.entity  || {};
        const runtime = runtimeData?.extraProperties?.entity || {};

        // Heap: os campos podem ter nomes diferentes dependendo da versão
        const heapUsed = parseInt(
            mem['usedheapsize-count']?.count || mem.usedheapsize?.count ||
            mem['heap-memory-usage-used']?.current || mem.used?.count || 0
        );
        const heapMax = parseInt(
            mem['maxheapsize-count']?.count || mem.maxheapsize?.count ||
            mem['heap-memory-usage-max']?.current || mem.max?.count || 0
        );
        const heapCom = parseInt(
            mem['committedheapsize-count']?.count || mem.committedheapsize?.count ||
            mem['heap-memory-usage-committed']?.current || mem.committed?.count || 0
        );

        // Threads
        const threadCount = parseInt(
            threads['threadcount']?.count || threads['liveThreadCount']?.count ||
            threads['thread-count']?.current || threads.threadcount?.count || 0
        );
        const threadPeak = parseInt(
            threads['peakthreadcount']?.count || threads['peakLiveThreadCount']?.count ||
            threads['peak-thread-count']?.current || threads.peakthreadcount?.count || 0
        );

        // Uptime da JVM via runtime
        const jvmUptime = parseInt(
            runtime['uptime-count']?.count || runtime.uptime?.count ||
            runtime['jvm-uptime']?.count || 0
        );

        logger.info('[telemetry] JVM parsed:', { heapUsed, heapMax, threadCount, jvmUptime });

        result.jvm = {
            heap: {
                used:      Math.round(heapUsed / 1024 / 1024),
                max:       Math.round(heapMax  / 1024 / 1024),
                committed: Math.round(heapCom  / 1024 / 1024),
                percent:   heapMax > 0 ? Math.round(heapUsed * 100 / heapMax) : 0,
                unit:      'MB'
            },
            threads:     { current: threadCount, peak: threadPeak },
            uptimeMs:    jvmUptime,
            uptimeHuman: jvmUptime > 0
                ? (Math.floor(jvmUptime / 3600000) + 'h ' + Math.floor((jvmUptime % 3600000) / 60000) + 'min')
                : null,
        };
    } catch (err) {
        logger.warn('[telemetry] JVM API falhou:', err.message);
        result.errors.push('JVM: ' + err.message);
    }

    res.json(result);
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