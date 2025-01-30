const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { createLogger, format, transports } = require('winston');
const { promisify } = require('util');
const { exec } = require('child_process');
const Glassfish = require('./models/glassfish');
const connectToDatabase = require('./db');
const { NodeSSH } = require('node-ssh');
const WebSocket = require('ws');
const xml2js = require('xml2js');
const fsPromises = require('fs').promises;
const multer = require('multer');
const logger = require('./utils/logger');
const mongoose = require('mongoose');

const app = express();
const ssh = new NodeSSH();

// Criar servidor WebSocket
const wss = new WebSocket.Server({ noServer: true });

// Utilitários de leitura e escrita de arquivos
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

// Caminhos dos arquivos
const CONFIG_PATH = path.join(__dirname, 'config.json');
const SUGGESTIONS_PATH = path.join(__dirname, 'sugestoes.json');

// Middlewares básicos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ativa logs do Mongoose
mongoose.set('debug', true);

// Adicionar middleware de log para todas as requisições
app.use((req, res, next) => {
    logger.info(`[REQUEST] ${req.method} ${req.url}`, {
        headers: req.headers,
        query: req.query,
        body: req.body
    });

    // Interceptar a resposta
    const oldSend = res.send;
    res.send = function(data) {
        logger.info(`[RESPONSE] ${req.method} ${req.url}`, {
            statusCode: res.statusCode,
            data: data
        });
        return oldSend.apply(res, arguments);
    };
    next();
});

// Servir arquivos estáticos ANTES das rotas da API
app.use(express.static(path.join(__dirname, 'public')));

// Importar routers (em um único lugar)
const glassfishRouter = require('./routes/glassfish');
const suggestionsRouter = require('./routes/suggestions');

// Registrar rotas da API
app.use('/api', glassfishRouter);
app.use('/api', suggestionsRouter);

// Middleware para erros 404
app.use((req, res) => {
    logger.warn(`404 - Rota não encontrada: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Rota não encontrada' });
});

// Middleware para erros gerais
app.use((err, req, res, next) => {
    logger.error('Erro na aplicação:', err);
    res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 5. Rotas da API do Glassfish
app.post('/api/test-ssh', async (req, res) => {
    try {
        const { host, username, password } = req.body;
        logger.info(`Testando conexão SSH para ${username}@${host}`);

        // Primeiro, testar conexão básica
        const testCommand = 'whoami && pwd';
        const result = await executeRemoteCommand(host, username, password, testCommand);

        if (result.code !== 0) {
            throw new Error(`Erro na conexão SSH básica: ${result.stderr}`);
        }

        // Depois, verificar o caminho do Glassfish
        const checkGlassfish = await executeRemoteCommand(
            host, 
            username, 
            password, 
            'ls -l /srv/glassfish6.2.5/glassfish/bin/asadmin'
        );

        logger.info('Teste SSH bem sucedido:', {
            basicTest: result,
            glassfishTest: checkGlassfish
        });

        res.json({
            success: true,
            message: 'Conexão SSH estabelecida com sucesso',
            details: {
                user: result.stdout.trim(),
                glassfishExists: checkGlassfish.code === 0
            }
        });
    } catch (error) {
        logger.error('Erro no teste SSH:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/servicos', async (req, res) => {
    try {
        const services = await Glassfish.find();
        res.json(services);
    } catch (err) {
        console.error('Erro ao obter serviços:', err);
        res.status(500).json({ error: 'Erro ao obter serviços' });
    }
});

app.post('/api/servicos', async (req, res) => {
    try {
        const { 
            name, 
            ip, 
            port, 
            domain, 
            password, 
            sshUsername, 
            sshPassword, 
            installPath,
            status,
            categoria  // Adicionar categoria aqui
        } = req.body;

        // Validação dos campos obrigatórios
        const requiredFields = ['name', 'ip', 'domain', 'sshUsername', 'sshPassword'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                error: 'Campos obrigatórios faltando', 
                fields: missingFields 
            });
        }

        // Log dos dados recebidos (removendo senhas sensíveis)
        logger.info('Dados recebidos para criação de serviço:', {
            ...req.body,
            password: '***',
            sshPassword: '***'
        });

        const newService = new Glassfish({ 
            name, 
            ip, 
            port: port || 8080, 
            domain, 
            password: password || 'admin', 
            sshUsername,
            sshPassword,
            installPath: installPath || '/srv/glassfish6.2.5',
            status: status || 'inactive',
            categoria: categoria || 'Cliente'  // Adicionar categoria aqui
        });

        await newService.save();
        res.status(201).json(newService);
    } catch (err) {
        logger.error('Erro ao criar serviço:', {
            error: err.message,
            stack: err.stack,
            validationErrors: err.errors
        });

        // Melhor tratamento de erros de validação do Mongoose
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Erro de validação',
                details: Object.values(err.errors).map(e => e.message)
            });
        }

        res.status(500).json({ 
            error: 'Erro ao criar serviço', 
            details: err.message 
        });
    }
});

app.put('/api/servicos/:id', async (req, res) => {
    try {
        const allowedUpdates = [
            'name', 'ip', 'port', 'domain', 'password', 
            'sshUsername', 'sshPassword', 'installPath', 
            'status', 'categoria' // Garantir que categoria está na lista
        ];
        
        const updates = {};
        Object.keys(req.body).forEach(key => {
            if (allowedUpdates.includes(key)) {
                updates[key] = req.body[key];
            }
        });

        const updatedService = await Glassfish.findByIdAndUpdate(
            req.params.id, 
            updates, 
            { new: true, runValidators: true }
        );

        if (!updatedService) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        res.json(updatedService);
    } catch (err) {
        console.error('Erro ao atualizar serviço:', err);
        res.status(500).json({ 
            error: 'Erro ao atualizar serviço',
            details: err.message 
        });
    }
});

app.delete('/api/servicos/:id', async (req, res) => {
    try {
        await Glassfish.findByIdAndDelete(req.params.id);
        res.json({ message: 'Serviço deletado com sucesso' });
    } catch (err) {
        console.error('Erro ao deletar serviço:', err);
        res.status(500).json({ error: 'Erro ao deletar serviço' });
    }
});

// 6. Outras rotas
app.get('/', (req, res) => {
    res.send('Página principal');
});

app.get('/menuRotinas', (req, res) => {
    res.json({ message: 'Menu de Rotinas' });
});

app.get('/menuConfig', (req, res) => {
    res.json({ message: 'Menu de Configuração' });
});

app.get('/menuUtilitariosCorpWeb', (req, res) => {
    res.json({ message: 'Menu Utilitários NeoCorp/NeoWeb' });
});

app.get('/menuUtilBancoDados', (req, res) => {
    res.json({ message: 'Menu Utilitários Banco de Dados' });
});

app.get('/menuNeoChamados', (req, res) => {
    res.json({ message: 'Menu Neo Chamados' });
});

// Rotas de configurações
app.get('/config', async (req, res) => {
    try {
        const configData = await readFileAsync(CONFIG_PATH, 'utf8');
        res.json(JSON.parse(configData));
    } catch (error) {
        console.error('Erro ao ler configurações:', error);
        res.status(500).json({ error: 'Erro ao ler configurações' });
    }
});

app.post('/config', async (req, res) => {
    try {
        const newConfig = req.body;
        await writeFileAsync(CONFIG_PATH, JSON.stringify(newConfig, null, 4));
        res.json({ message: 'Configurações atualizadas com sucesso' });
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
});

// Rotas para gerenciamento de sugestões
app.get('/suggestions', async (req, res) => {
    try {
        const data = await readFileAsync(SUGGESTIONS_PATH, 'utf8');
        const suggestions = JSON.parse(data || '[]');
        res.json(suggestions);
    } catch (error) {
        console.error('Erro ao carregar sugestões:', error);
        res.status(500).json({ error: 'Erro ao carregar sugestões' });
    }
});

app.post('/suggestions', async (req, res) => {
    try {
        const newSuggestion = req.body;
        newSuggestion.date = new Date().toISOString(); // Adiciona a data da solicitação

        const data = await readFileAsync(SUGGESTIONS_PATH, 'utf8');
        const suggestions = JSON.parse(data || '[]');
        suggestions.push(newSuggestion);

        await writeFileAsync(SUGGESTIONS_PATH, JSON.stringify(suggestions, null, 4));
        res.status(201).json({ message: 'Sugestão salva com sucesso!' });
    } catch (error) {
        console.error('Erro ao salvar sugestão:', error);
        res.status(500).json({ error: 'Erro ao salvar sugestão' });
    }
});

// Rotas para gerenciamento de GlassFish
app.get('/api/servicos/glassfish', async (req, res) => {
    try {
        const services = await Glassfish.find();
        res.json(services);
    } catch (error) {
        console.error('Erro ao obter serviços GlassFish:', error);
        res.status(500).json({ error: 'Erro ao obter serviços GlassFish' });
    }
});

app.post('/api/servicos/glassfish', async (req, res) => {
    try {
        const { name, ip, port, domain, password, status } = req.body;
        const newService = new Glassfish({ name, ip, port, domain, password, status });
        await newService.save();
        res.status(201).json(newService);
    } catch (error) {
        console.error('Erro ao criar serviço GlassFish:', error);
        res.status(500).json({ error: 'Erro ao criar serviço GlassFish' });
    }
});

// Atualizar rotas PUT e DELETE para GlassFish
app.put('/api/servicos/glassfish/:id', async (req, res) => {
    try {
        const updatedService = await Glassfish.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedService);
    } catch (error) {
        console.error('Erro ao atualizar serviço GlassFish:', error);
        res.status(500).json({ error: 'Erro ao atualizar serviço GlassFish' });
    }
});

app.delete('/api/servicos/glassfish/:id', async (req, res) => {
    try {
        await Glassfish.findByIdAndDelete(req.params.id);
        res.json({ message: 'Serviço GlassFish deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar serviço GlassFish:', error);
        res.status(500).json({ error: 'Erro ao deletar serviço GlassFish' });
    }
});

// Rotas para funcionalidades do GlassFish
const executeGlassFishCommand = (command, service, res) => {
    exec(`asadmin ${command}-${service.domain}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro ao executar comando GlassFish: ${error.message}`);
            return res.status(500).json({ error: `Erro ao executar comando GlassFish: ${error.message}` });
        }
        // Atualizar status do serviço
        service.status = command === 'start' ? 'active' : 'inactive';
        service.save();
        res.json({ message: `GlassFish ${command} com sucesso`, output: stdout });
    });
};

app.post('/api/servicos/glassfish/:id/start', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        // Verificar se o serviço já está rodando
        const checkCommand = `ps aux | grep "[j]ava.*${service.domain}" | grep -v grep`;
        const checkResult = await executeRemoteCommand(
            service.ip,
            service.sshUsername,
            service.sshPassword,
            checkCommand
        );

        if (checkResult.stdout.trim()) {
            logger.info('Serviço já está rodando');
            service.status = 'active';
            await service.save();
            return res.json({ message: 'Serviço já está rodando' });
        }

        // Construir o comando de início com o domínio específico
        const asadminPath = `${service.installPath}/glassfish/bin/asadmin`;
        const startCommand = `${asadminPath} start-domain --domaindir ${service.installPath}/glassfish/domains ${service.domain}`;
        logger.info('Executando comando de início:', { command: startCommand });

        // Verificar se o asadmin existe
        const checkAsadmin = await executeRemoteCommand(
            service.ip,
            service.sshUsername,
            service.sshPassword,
            `test -f "${asadminPath}" && echo "exists"`
        );

        if (!checkAsadmin.stdout.includes('exists')) {
            throw new Error(`Arquivo asadmin não encontrado em: ${asadminPath}`);
        }

        const result = await executeRemoteCommand(
            service.ip,
            service.sshUsername,
            service.sshPassword,
            startCommand
        );

        if (result.code === 0 || result.stdout.includes('Command start-domain executed successfully')) {
            const status = await checkGlassfishStatus(service.ip, service.sshUsername, service.sshPassword, service.domain);
            service.status = status.status;
            service.pid = status.pid;
            await service.save();
            res.json({ message: 'Serviço iniciado com sucesso', pid: status.pid });
        } else {
            logger.error('Erro ao iniciar serviço:', {
                stdout: result.stdout,
                stderr: result.stderr,
                code: result.code,
                command: startCommand
            });
            throw new Error(result.stderr || 'Erro ao iniciar serviço');
        }
    } catch (error) {
        logger.error('Erro ao iniciar serviço:', error);
        res.status(500).json({ 
            error: 'Erro ao iniciar serviço', 
            details: error.message 
        });
    }
});

// Função utilitária para executar comandos SSH
async function executeRemoteCommand(host, username, password, command, timeout = 30000) {
    const ssh = new NodeSSH();
    
    try {
        await ssh.connect({
            host,
            username,
            password,
            readyTimeout: timeout
        });

        // Não modificar o comando aqui, pois já estamos tratando o sudo no comando específico
        const result = await ssh.execCommand(command, {
            cwd: '/',
            onStderr: (chunk) => {
                logger.error('SSH stderr:', chunk.toString('utf8'));
            }
        });

        return result;
    } finally {
        ssh.dispose();
    }
}

// Função para verificar status do Glassfish via PID
async function checkGlassfishStatus(host, username, password, domain) {
    if (!host || !username || !password || !domain) {
        throw new Error('Parâmetros incompletos para verificação de status');
    }

    // Lista todos os processos Java e filtra pelo domain específico
    const pidCommand = `ps aux | grep "[j]ava.*${domain}" | grep -v grep`;
    const result = await executeRemoteCommand(host, username, password, pidCommand);
    
    if (result.stdout.trim()) {
        const pid = result.stdout.trim().split(/\s+/)[1];
        
        if (pid) {
            return { 
                status: 'active',
                pid: parseInt(pid)
            };
        }
    }
    return { status: 'inactive', pid: null };
}

// Função para construir caminhos do Glassfish
function buildGlassfishPaths(service) {
    // Remove trailing slash se existir
    const basePath = service.installPath.replace(/\/$/, '');
    logger.info('Construindo caminhos Glassfish:', {
        basePath,
        domain: service.domain
    });

    const paths = {
        binPath: `${basePath}/glassfish/bin`,
        logsPath: `${basePath}/glassfish/domains/${service.domain}/logs`,
        domainPath: `${basePath}/glassfish/domains/${service.domain}`,
        asadmin: `${basePath}/glassfish/bin/asadmin`
    };

    logger.info('Caminhos construídos:', paths);
    return paths;
}

// Rotas para gerenciamento remoto do Glassfish
app.post('/api/servicos/:id/status', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        const status = await checkGlassfishStatus(
            service.ip, 
            service.sshUsername,
            service.sshPassword,
            service.domain
        );
        
        // Atualiza o status no banco de dados
        if (service.status !== (status.status === 'active' ? 'active' : 'inactive')) {
            service.status = status.status === 'active' ? 'active' : 'inactive';
            service.pid = status.pid;
            await service.save();
        }

        res.json({
            status: status.status === 'active' ? 'ativo' : 'inativo',
            pid: status.pid
        });
    } catch (error) {
        logger.error('Erro ao verificar status:', error);
        res.status(500).json({ error: 'Erro ao verificar status do serviço' });
    }
});

// Rota para obter logs
app.get('/api/servicos/:id/logs', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        const paths = buildGlassfishPaths(service);
        const logCommand = `tail -n 100 ${paths.logsPath}/server.log`;
        const result = await executeRemoteCommand(service.ip, service.sshUsername, service.sshPassword, logCommand);

        if (result.code === 0) {
            res.json({ logs: result.stdout });
        } else {
            res.status(500).json({ error: 'Erro ao obter logs', details: result.stderr });
        }
    } catch (error) {
        console.error('Erro ao obter logs:', error);
        res.status(500).json({ error: 'Erro ao obter logs' });
    }
});

// WebSocket para logs em tempo real
app.get('/api/servicos/:id/logs/live', (req, res) => {
    wss.handleUpgrade(req, req.socket, Buffer.alloc(0), async (ws) => {
        try {
            const service = await Glassfish.findById(req.params.id);
            if (!service) {
                ws.close();
                return;
            }

            const paths = buildGlassfishPaths(service);
            const sshConnection = new NodeSSH();
            await sshConnection.connect({
                host: service.ip,
                username: service.sshUsername,
                password: service.sshPassword
            });

            const command = `tail -f ${paths.logsPath}/server.log`;
            const stream = await sshConnection.execCommand(command, { stream: 'both' });

            stream.stdout.on('data', (data) => {
                ws.send(data.toString());
            });

            stream.stderr.on('data', (data) => {
                ws.send(`ERROR: ${data.toString()}`);
            });

            ws.on('close', () => {
                stream.kill();
                sshConnection.dispose();
            });
        } catch (error) {
            console.error('Erro na conexão WebSocket:', error);
            ws.close();
        }
    });
});

// Rota para obter configurações do domain.xml
app.get('/api/servicos/:id/domain-config', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        const result = await tryReadDomainXml(service);
        
        // Parsear o XML com opções específicas
        const parser = new xml2js.Parser({
            explicitArray: true,
            mergeAttrs: false,
            attrkey: '$'
        });

        try {
            const xmlData = await parser.parseStringPromise(result.stdout);
            logger.info('XML parseado com sucesso');

            // Navegar até o pool de conexão
            const resources = xmlData.domain.resources[0];
            const jdbcPools = resources['jdbc-connection-pool'];

            // Encontrar o pool específico
            const pool = jdbcPools.find(p => p.$.name === 'Pg_Neocorp_Pool');
            if (!pool) {
                throw new Error('Pool Pg_Neocorp_Pool não encontrado');
            }

            // Extrair as propriedades
            const config = {
                serverName: '',
                user: '',
                password: '',
                databaseName: ''
            };

            pool.property.forEach(prop => {
                const name = prop.$.name;
                const value = prop.$.value;
                
                switch (name) {
                    case 'serverName':
                        config.serverName = value;
                        break;
                    case 'user':
                        config.user = value;
                        break;
                    case 'password':
                        config.password = value;
                        break;
                    case 'databaseName':
                        config.databaseName = value;
                        break;
                }
            });

            logger.info('Configurações encontradas:', {
                ...config,
                password: '***'
            });

            res.json(config);

        } catch (parseError) {
            logger.error('Erro ao processar XML:', parseError);
            throw parseError;
        }
    } catch (error) {
        logger.error('Erro ao ler configurações:', error);
        res.status(500).json({ 
            error: 'Erro ao ler configurações',
            details: error.message 
        });
    }
});

// Rota para salvar configurações no domain.xml
app.put('/api/servicos/:id/domain-config', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        // Ler o arquivo atual
        const result = await tryReadDomainXml(service);
        
        // Parsear o XML existente
        const parser = new xml2js.Parser({ explicitArray: false });
        const xmlData = await parser.parseStringPromise(result.stdout);

        // Encontrar o pool de conexão
        const resources = xmlData.domain.resources;
        const pools = Array.isArray(resources['jdbc-connection-pool']) 
            ? resources['jdbc-connection-pool'] 
            : [resources['jdbc-connection-pool']];

        const jdbcPool = pools.find(pool => 
            pool.$ && pool.$.name === 'Pg_Neocorp_Pool'
        );

        if (!jdbcPool) {
            throw new Error('Pool de conexão não encontrado');
        }

        // Atualizar as propriedades
        const properties = Array.isArray(jdbcPool.property) ? jdbcPool.property : [jdbcPool.property];
        properties.forEach(prop => {
            if (prop && prop.$) {
                switch (prop.$.name) {
                    case 'serverName':
                        prop.$.value = req.body.serverName;
                        break;
                    case 'user':
                        prop.$.value = req.body.user;
                        break;
                    case 'password':
                        prop.$.value = req.body.password;
                        break;
                    case 'databaseName':
                        prop.$.value = req.body.databaseName;
                        break;
                }
            }
        });

        // Converter de volta para XML
        const builder = new xml2js.Builder();
        const updatedXml = builder.buildObject(xmlData);

        // Criar arquivo temporário e mover para o local correto
        const tempFile = '/tmp/domain.xml.tmp';
        const writeCommand = `echo '${updatedXml.replace(/'/g, '\'\\\'\'')}' > ${tempFile} && sudo mv ${tempFile} "${result.filePath}"`;
        
        const writeResult = await executeRemoteCommand(
            service.ip,
            service.sshUsername,
            service.sshPassword,
            writeCommand
        );

        if (writeResult.code !== 0) {
            throw new Error(`Erro ao salvar arquivo: ${writeResult.stderr}`);
        }

        logger.info('Configurações salvas com sucesso');
        res.json({ message: 'Configurações atualizadas com sucesso' });

    } catch (error) {
        logger.error('Erro ao salvar configurações:', error);
        res.status(500).json({ 
            error: 'Erro ao salvar configurações',
            details: error.message 
        });
    }
});

// Rota para listar aplicações
app.get('/api/servicos/:id/applications', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        const result = await tryReadDomainXml(service);
        
        // Parsear o XML com opções específicas
        const parser = new xml2js.Parser({
            explicitArray: true,
            mergeAttrs: false,
            attrkey: '$'
        });

        try {
            const xmlData = await parser.parseStringPromise(result.stdout);
            
            // Verificar se há aplicações
            if (!xmlData.domain.applications || !xmlData.domain.applications[0].application) {
                return res.json([]);
            }

            // Extrair aplicações
            const applications = xmlData.domain.applications[0].application;

            // Filtrar e mapear as aplicações
            const appList = applications
                .filter(app => app.$['object-type'] === 'user')
                .map(app => ({
                    name: app.$.name,
                    location: app.$.location
                }));

            res.json(appList);

        } catch (parseError) {
            logger.error('Erro ao processar XML das aplicações:', parseError);
            res.json([]);
        }
    } catch (error) {
        logger.error('Erro ao listar aplicações:', error);
        res.status(500).json({ 
            error: 'Erro ao listar aplicações',
            details: error.message 
        });
    }
});

// Configuração do multer para upload
const uploadsDir = path.join(__dirname, 'uploads');

// Criar diretório de uploads se não existir
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadsDir);
        },
        filename: function (req, file, cb) {
            // Manter o nome original do arquivo
            cb(null, file.originalname);
        }
    }),
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB
    }
});

// Rota para parar o serviço
app.post('/api/servicos/:id/stop', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        // Comando para parar o domínio específico
        const stopCommand = `
            echo '${service.sshPassword}' | sudo -S bash -c '
                cd ${service.installPath}/glassfish/bin &&
                ./asadmin stop-domain ${service.domain}
            '
        `;
        
        const result = await executeRemoteCommand(
            service.ip,
            service.sshUsername,
            service.sshPassword,
            stopCommand,
            30000
        );

        if (result.code !== 0) {
            throw new Error(result.stderr || 'Erro ao parar serviço');
        }

        // Atualizar status para inactive ao invés de stopped
        service.status = 'inactive';
        service.pid = null;
        await service.save();

        res.json({ message: 'Serviço parado com sucesso' });
    } catch (error) {
        logger.error('Erro ao parar serviço:', error);
        res.status(500).json({
            error: 'Erro ao parar serviço',
            details: error.message
        });
    }
});

// Rota para upload de aplicação
app.post('/api/servicos/:id/upload-application', upload.single('file'), async (req, res) => {
    let localFilePath = null;
    
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        const autodeployPath = `${service.installPath}/glassfish/domains/${service.domain}/autodeploy`;
        localFilePath = path.join(uploadsDir, req.file.originalname);

        // Mover arquivo do buffer temporário para diretório de uploads
        await fs.promises.rename(req.file.path, localFilePath);

        // Usar scp diretamente ao invés de executeRemoteCommand
        const scp = new NodeSSH();
        await scp.connect({
            host: service.ip,
            username: service.sshUsername,
            password: service.sshPassword
        });

        try {
            await scp.putFile(localFilePath, `/tmp/${req.file.originalname}`);
        } finally {
            scp.dispose();
        }

        // Mover arquivo para autodeploy (sem tentar mudar owner)
        const moveCommand = `
            echo '${service.sshPassword}' | sudo -S bash -c '
                rm -f "${autodeployPath}/${req.file.originalname}" &&
                mv "/tmp/${req.file.originalname}" "${autodeployPath}/"
            '
        `;

        const moveResult = await executeRemoteCommand(
            service.ip,
            service.sshUsername,
            service.sshPassword,
            moveCommand
        );

        if (moveResult.code !== 0) {
            throw new Error(moveResult.stderr || 'Erro ao mover arquivo');
        }

        res.json({ message: 'Upload realizado com sucesso' });
    } catch (error) {
        logger.error('Erro no upload:', error);
        res.status(500).json({ 
            error: 'Erro no upload',
            details: error.message
        });
    } finally {
        // Limpar arquivos temporários
        try {
            if (localFilePath && fs.existsSync(localFilePath)) {
                await fs.promises.unlink(localFilePath);
            }
        } catch (err) {
            logger.error('Erro ao remover arquivo temporário:', err);
        }
    }
});

// Rota de health check
app.get('/api/health-check', (req, res) => {
    res.json({ status: 'ok' });
});

// Definir todas as rotas primeiro
app.post('/api/servicos/:id/maintenance', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        const { tasks } = req.body;
        if (!tasks || !Array.isArray(tasks)) {
            return res.status(400).json({ error: 'Tarefas de manutenção não especificadas' });
        }

        const results = [];
        for (const task of tasks) {
            const basePath = `${service.installPath}/glassfish/domains/${service.domain}`;
            let command = '';

            switch (task) {
                case 'cleanLogs':
                    command = `
                        echo '${service.sshPassword}' | sudo -S bash -c '
                            rm -f ${basePath}/logs/server.log* &&
                            rm -f ${basePath}/logs/server.log.* &&
                            echo "" > ${basePath}/logs/server.log
                        '
                    `;
                    break;
                case 'cleanApplications':
                    command = `echo '${service.sshPassword}' | sudo -S bash -c 'rm -rf ${basePath}/applications/*'`;
                    break;
                case 'cleanGenerated':
                    command = `echo '${service.sshPassword}' | sudo -S bash -c 'rm -rf ${basePath}/generated/*'`;
                    break;
                case 'cleanAutodeploy':
                    command = `echo '${service.sshPassword}' | sudo -S bash -c 'rm -rf ${basePath}/autodeploy/*'`;
                    break;
                default:
                    continue;
            }

            if (command) {
                const result = await executeRemoteCommand(
                    service.ip,
                    service.sshUsername,
                    service.sshPassword,
                    command
                );

                results.push({
                    task,
                    success: result.code === 0,
                    message: result.code === 0 ? 
                        `${task} executado com sucesso` : 
                        result.stderr || `Erro ao executar ${task}`
                });
            }
        }

        res.json({ 
            message: 'Tarefas de manutenção executadas',
            results 
        });
    } catch (error) {
        logger.error('Erro na manutenção:', error);
        res.status(500).json({
            error: 'Erro na manutenção',
            details: error.message
        });
    }
});

// Adicionar no final do arquivo server.js
const PORT = process.env.PORT || 3000;

// Conectar ao MongoDB antes de iniciar o servidor
connectToDatabase()
    .then(() => {
        logger.info('Iniciando servidor...', {
            port: PORT,
            env: process.env.NODE_ENV,
            publicPath: path.join(__dirname, 'public')
        });

        const server = app.listen(PORT, () => {
            logger.info('Servidor iniciado com sucesso', {
                port: PORT,
                pid: process.pid,
                memoryUsage: process.memoryUsage()
            });
        });

        server.on('error', (error) => {
            logger.error('Erro no servidor:', error);
        });
    })
    .catch(error => {
        logger.error('Falha ao iniciar servidor:', error);
        process.exit(1);
    });

function buildDomainPath(service) {
    const installPath = service.installPath.replace(/\/+$/, '').replace(/\/+/g, '/');
    
    const basePaths = [
        // Caminhos baseados no installPath
        `${installPath}/glassfish/domains/${service.domain}/config/domain.xml`,
        `${installPath}/domains/${service.domain}/config/domain.xml`,
        // Caminhos absolutos comuns
        `/srv/glassfish6.2.5/glassfish/domains/${service.domain}/config/domain.xml`,
        `/srv/glassfish/glassfish/domains/${service.domain}/config/domain.xml`, 
        `/opt/glassfish6.2.5/glassfish/domains/${service.domain}/config/domain.xml`,
        `/opt/glassfish/glassfish/domains/${service.domain}/config/domain.xml`,
        `/glassfish6.2.5/glassfish/domains/${service.domain}/config/domain.xml`,
        `/glassfish/glassfish/domains/${service.domain}/config/domain.xml`,
        // Versão sem glassfish duplicado no path
        `/srv/glassfish6.2.5/domains/${service.domain}/config/domain.xml`,
        `/opt/glassfish6.2.5/domains/${service.domain}/config/domain.xml`,
        `/glassfish6.2.5/domains/${service.domain}/config/domain.xml`
    ];

    logger.info('Caminhos possíveis para domain.xml:', {
        installPath,
        paths: basePaths
    });

    return basePaths;
}

// Na função que lê o domain.xml
async function tryReadDomainXml(service) {
    const paths = buildDomainPath(service);
    let lastError = null;

    logger.info('Tentando ler domain.xml para o serviço:', {
        serviceName: service.name,
        serviceIP: service.ip
    });

    // Primeiro tentar um comando find direto
    try {
        const findCommand = 'find /srv /opt /glassfish* -name domain.xml 2>/dev/null | grep neosistemas/config/domain.xml';
        logger.info('Executando busca por domain.xml:', { command: findCommand });
        
        const findResult = await executeRemoteCommand(
            service.ip,
            service.sshUsername,
            service.sshPassword,
            findCommand
        );

        if (findResult.stdout) {
            const foundPath = findResult.stdout.trim();
            logger.info('Arquivo domain.xml encontrado:', { path: foundPath });

            const readResult = await executeRemoteCommand(
                service.ip,
                service.sshUsername,
                service.sshPassword,
                `cat "${foundPath}"`
            );

            if (readResult.code === 0 && readResult.stdout) {
                logger.info('Arquivo domain.xml lido com sucesso');
                return { ...readResult, filePath: foundPath };
            }
        }
    } catch (findError) {
        logger.warn('Erro na busca inicial:', findError.message);
    }

    // Tentar caminhos predefinidos
    for (const domainPath of paths) {
        if (domainPath.includes('find')) continue;

        try {
            logger.info('Tentando ler arquivo:', { path: domainPath });
            
            const result = await executeRemoteCommand(
                service.ip,
                service.sshUsername,
                service.sshPassword,
                `cat "${domainPath}"`
            );

            if (result.code === 0 && result.stdout) {
                logger.info('Arquivo lido com sucesso:', { path: domainPath });
                return { ...result, filePath: domainPath };
            }
        } catch (error) {
            lastError = error;
            logger.warn('Falha ao ler arquivo:', {
                path: domainPath,
                error: error.message
            });
        }
    }

    logger.error('Não foi possível encontrar ou ler o domain.xml');
    throw lastError || new Error('Não foi possível encontrar o arquivo domain.xml');
}
