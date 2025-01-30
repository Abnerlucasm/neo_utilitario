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
const suggestionsRouter = require('./routes/suggestions');
const xml2js = require('xml2js');
const fsPromises = require('fs').promises;
const multer = require('multer');

const app = express();
const ssh = new NodeSSH();

// Configuração do logger
const logger = createLogger({
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.File({ filename: 'error.log', level: 'error' }),
        new transports.File({ filename: 'combined.log' }),
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.simple()
            )
        })
    ]
});

// Criar servidor WebSocket
const wss = new WebSocket.Server({ noServer: true });

// Utilitários de leitura e escrita de arquivos
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

// Caminhos dos arquivos
const CONFIG_PATH = path.join(__dirname, 'config.json');
const SUGGESTIONS_PATH = path.join(__dirname, 'sugestoes.json');

// 1. Middlewares básicos
app.use(express.static(path.join(__dirname, '/public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Middleware para tratar erros JSON
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        logger.error('JSON Parse Error:', err);
        return res.status(400).json({ error: 'JSON inválido' });
    }
    next();
});

// 3. Importar routers
const glassfishRouter = require('./routes/glassfish');

// 4. Registrar rotas da API
app.use('/api', suggestionsRouter);
app.use('/api', glassfishRouter);

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
            service.status = 'running';
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

        const result = await executeRemoteCommand(service.ip, service.sshUsername, service.sshPassword, startCommand);

        if (result.code === 0 || result.stdout.includes('Command start-domain executed successfully')) {
            const status = await checkGlassfishStatus(service.ip, service.sshUsername, service.sshPassword, service.domain);
            service.status = 'active';
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
            res.status(500).json({ 
                error: 'Erro ao iniciar serviço', 
                details: result.stderr || result.stdout,
                command: startCommand,
                paths: { asadminPath }
            });
        }
    } catch (error) {
        logger.error('Erro ao iniciar serviço:', error);
        res.status(500).json({ error: 'Erro ao iniciar serviço', details: error.message });
    }
});

app.post('/api/servicos/glassfish/:id/stop', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        // Verificar se o serviço está rodando
        const checkCommand = `ps aux | grep "[j]ava.*${service.domain}" | grep -v grep`;
        const checkResult = await executeRemoteCommand(
            service.ip,
            service.sshUsername,
            service.sshPassword,
            checkCommand
        );

        if (!checkResult.stdout.trim()) {
            logger.info('Serviço já está parado');
            service.status = 'stopped';
            await service.save();
            return res.json({ message: 'Serviço já está parado' });
        }

        const stopCommand = `cd ${service.installPath}/glassfish/bin && sudo ./asadmin stop-domain ${service.domain}`;
        
        logger.info('Executando comando de parada:', { command: stopCommand });

        const result = await executeRemoteCommand(
            service.ip,
            service.sshUsername,
            service.sshPassword,
            stopCommand
        );

        logger.info('Resultado do comando stop:', {
            stdout: result.stdout,
            stderr: result.stderr,
            code: result.code
        });

        service.status = 'stopped';
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

app.post('/api/servicos/glassfish/:id/restart', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }
        executeGlassFishCommand('restart', service, res);
    } catch (error) {
        console.error('Erro ao reiniciar GlassFish:', error);
        res.status(500).json({ error: 'Erro ao reiniciar GlassFish' });
    }
});

app.get('/glassfish/status', (req, res) => {
    exec('asadmin list-domains', (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro ao verificar status do GlassFish: ${error.message}`);
            return res.status(500).json({ error: 'Erro ao verificar status do GlassFish' });
        }
        const isRunning = stdout.includes('running');
        res.json({ status: isRunning ? 'ativo' : 'parado', output: stdout });
    });
});

const isProcessRunning = (pid) => {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return false;
    }
};

// Atualizar rota de status para verificar o PID
app.get('/api/servicos/glassfish/:id/status', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        if (service.pid) {
            const running = isProcessRunning(service.pid);
            service.status = running ? 'active' : 'inactive';
            await service.save();
            return res.json({ status: running ? 'ativo' : 'parado' });
        } else {
            return res.json({ status: 'PID não registrado' });
        }
    } catch (error) {
        console.error('Erro ao verificar status do GlassFish:', error);
        res.status(500).json({ error: 'Erro ao verificar status do GlassFish' });
    }
});

app.get('/api/servicos/glassfish/:id/logs', async (req, res) => {
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

// Função auxiliar para executar comandos SSH
async function executeRemoteCommand(host, username, password, command, stdin) {
    const ssh = new NodeSSH();
    try {
        logger.info(`Iniciando comando SSH:`, {
            host,
            username,
            command: command.includes('password') ? '[SENHA OCULTA]' : command
        });

        const sshConfig = {
            host,
            username,
            password,
            readyTimeout: 30000,
            keepaliveInterval: 10000,
            keepaliveCountMax: 3,
            debug: process.env.NODE_ENV === 'development',
            algorithms: {
                kex: [
                    'diffie-hellman-group1-sha1',
                    'diffie-hellman-group14-sha1',
                    'ecdh-sha2-nistp256',
                    'ecdh-sha2-nistp384',
                    'ecdh-sha2-nistp521',
                    'diffie-hellman-group-exchange-sha256'
                ],
                cipher: [
                    'aes128-ctr',
                    'aes192-ctr',
                    'aes256-ctr',
                    'aes128-gcm',
                    'aes256-gcm'
                ],
                serverHostKey: [
                    'ssh-rsa',
                    'ecdsa-sha2-nistp256',
                    'ecdsa-sha2-nistp384',
                    'ecdsa-sha2-nistp521'
                ]
            }
        };

        await ssh.connect(sshConfig);
        
        // Se tiver conteúdo para stdin
        if (stdin) {
            return await ssh.execCommand(command, {
                stdin: stdin,
                execOptions: {
                    pty: true
                }
            });
        }

        const result = await ssh.execCommand(command, {
            execOptions: {
                pty: true
            }
        });

        logger.info('Comando executado:', {
            command: command.includes('password') ? '[SENHA OCULTA]' : command,
            code: result.code,
            stdout: result.stdout,
            stderr: result.stderr
        });

        return result;
    } catch (error) {
        logger.error('Erro na execução do comando SSH:', error);
        throw error;
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
                running: true, 
                pid: parseInt(pid)
            };
        }
    }
    return { running: false, pid: null };
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
        if (service.status !== (status.running ? 'active' : 'inactive')) {
            service.status = status.running ? 'active' : 'inactive';
            service.pid = status.pid;
            await service.save();
        }

        res.json({
            status: status.running ? 'ativo' : 'inativo',
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

// Configurar o multer para upload
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        try {
            const service = await Glassfish.findById(req.params.id);
            if (!service) {
                return cb(new Error('Serviço não encontrado'));
            }

            const autodeployPath = path.join(
                service.installPath,
                'glassfish/domains',
                service.domain,
                'autodeploy'
            );

            // Criar diretório se não existir
            await fsPromises.mkdir(autodeployPath, { recursive: true });
            cb(null, autodeployPath);
        } catch (error) {
            cb(error);
        }
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB
    }
});

// Rota para upload de aplicação
app.post('/api/servicos/glassfish/:id/upload-application', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        const autodeployPath = `${service.installPath}/glassfish/domains/${service.domain}/autodeploy`;
        // Primeiro, copiar o arquivo para o servidor
        const scpCommand = `scp ${req.file.path} ${service.sshUsername}@${service.ip}:/tmp/`;
        await executeRemoteCommand(service.ip, service.sshUsername, service.sshPassword, scpCommand);

        // Depois, mover o arquivo para o diretório autodeploy com sudo
        const moveCommand = `sudo mv /tmp/${req.file.originalname} ${autodeployPath}/`;
        const result = await executeRemoteCommand(
            service.ip,
            service.sshUsername,
            service.sshPassword,
            moveCommand
        );

        // Limpar arquivo temporário local
        fs.unlinkSync(req.file.path);

        if (result.code !== 0) {
            throw new Error(result.stderr || 'Erro ao fazer upload do arquivo');
        }

        res.json({ message: 'Upload realizado com sucesso' });
    } catch (error) {
        logger.error('Erro no upload:', error);
        res.status(500).json({ 
            error: 'Erro no upload',
            details: error.message
        });
    }
});

// Rota de health check
app.get('/api/health-check', (req, res) => {
    res.json({ status: 'ok' });
});

// 7. Middleware 404 (após todas as rotas)
app.use((req, res, next) => {
    if (req.accepts('html')) {
        res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
        return;
    }

    if (req.accepts('json')) {
        res.status(404).json({ error: 'Not found' });
        return;
    }

    res.status(404).type('txt').send('Not found');
});

// 8. Middleware 500 (último middleware)
app.use((err, req, res, next) => {
    logger.error('Erro interno do servidor:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    if (req.accepts('html')) {
        res.status(500).sendFile(path.join(__dirname, 'public', '500.html'));
        return;
    }

    if (req.accepts('json')) {
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
        });
        return;
    }

    res.status(500).type('txt').send('Internal Server Error');
});

// 9. Inicialização do servidor
connectToDatabase()
    .then(() => {
        const PORT = process.env.PORT || 3000;
        const server = app.listen(PORT, () => {
            logger.info(`Servidor iniciado na porta ${PORT}`);
            logger.info('Configurações do servidor:', {
                port: PORT,
                env: process.env.NODE_ENV,
                mongodb: process.env.MONGODB_URI
            });
        });

        // Tratamento de erros do servidor
        server.on('error', (error) => {
            logger.error('Erro no servidor:', error);
            if (error.code === 'EADDRINUSE') {
                logger.error(`Porta ${PORT} já está em uso`);
                process.exit(1);
            }
        });

        // Manter o servidor vivo mesmo com erros não tratados
        process.on('uncaughtException', (error) => {
            logger.error('Erro não tratado:', error);
        });

        process.on('unhandledRejection', (error) => {
            logger.error('Promise rejeitada não tratada:', error);
        });

        server.on('upgrade', (request, socket, head) => {
            wss.handleUpgrade(request, socket, head, ws => {
                wss.emit('connection', ws, request);
            });
        });
    })
    .catch(err => {
        logger.error('Erro ao conectar ao banco de dados:', {
            error: err.message,
            stack: err.stack
        });
        // Tentar reconectar ao banco de dados
        setTimeout(() => {
            logger.info('Tentando reconectar ao banco de dados...');
            connectToDatabase();
        }, 5000);
    });

function buildDomainPath(service) {
    const installPath = service.installPath.replace(/\/+$/, '').replace(/\/+/g, '/');
    
    const basePaths = [
        // Caminhos baseados no installPath
        `${installPath}/glassfish/domains/neosistemas/config/domain.xml`,
        `${installPath}/domains/neosistemas/config/domain.xml`,
        // Caminhos absolutos comuns
        '/srv/glassfish6.2.5/glassfish/domains/neosistemas/config/domain.xml',
        '/srv/glassfish/glassfish/domains/neosistemas/config/domain.xml',
        '/opt/glassfish6.2.5/glassfish/domains/neosistemas/config/domain.xml',
        '/opt/glassfish/glassfish/domains/neosistemas/config/domain.xml',
        '/glassfish6.2.5/glassfish/domains/neosistemas/config/domain.xml',
        '/glassfish/glassfish/domains/neosistemas/config/domain.xml',
        // Versão sem glassfish duplicado no path
        '/srv/glassfish6.2.5/domains/neosistemas/config/domain.xml',
        '/opt/glassfish6.2.5/domains/neosistemas/config/domain.xml',
        '/glassfish6.2.5/domains/neosistemas/config/domain.xml'
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

async function executeCleanup(service, paths) {
    const baseCommand = `cd "${service.installPath}/glassfish/domains/${service.domain}" && `;
    let commands = [];

    if (paths.includes('applications')) {
        commands.push('rm -rf applications/*');
    }
    if (paths.includes('logs')) {
        commands.push('rm -rf logs/*');
    }
    if (paths.includes('generated')) {
        commands.push('rm -rf generated/*');
    }
    if (paths.includes('autodeploy')) {
        commands.push('rm -rf autodeploy/*');
    }

    if (commands.length === 0) {
        return { success: true, message: 'Nenhuma ação executada' };
    }

    const fullCommand = baseCommand + commands.join(' && ');
    
    try {
        const result = await executeRemoteCommand(
            service.ip,
            service.sshUsername,
            service.sshPassword,
            fullCommand
        );

        if (result.code !== 0) {
            throw new Error(result.stderr);
        }

        return { success: true, message: 'Limpeza executada com sucesso' };
    } catch (error) {
        logger.error('Erro na limpeza:', error);
        throw error;
    }
}

// Rota para manutenção
app.post('/api/servicos/glassfish/:id/maintenance', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        const { cleanApplications, cleanLogs, cleanGenerated, cleanAutodeploy } = req.body;
        let log = [];

        // Construir o caminho base do domínio
        const domainPath = `${service.installPath}/glassfish/domains/${service.domain}`;

        // Executar as limpezas solicitadas
        if (cleanApplications) {
            const result = await executeRemoteCommand(
                service.ip,
                service.sshUsername,
                service.sshPassword,
                `sudo rm -rfv ${domainPath}/applications/*`
            );
            log.push('Applications:', result.stdout);
        }

        if (cleanLogs) {
            const result = await executeRemoteCommand(
                service.ip,
                service.sshUsername,
                service.sshPassword,
                `sudo rm -rfv ${domainPath}/logs/*`
            );
            log.push('Logs:', result.stdout);
        }

        if (cleanGenerated) {
            const result = await executeRemoteCommand(
                service.ip,
                service.sshUsername,
                service.sshPassword,
                `sudo rm -rfv ${domainPath}/generated/*`
            );
            log.push('Generated:', result.stdout);
        }

        if (cleanAutodeploy) {
            const result = await executeRemoteCommand(
                service.ip,
                service.sshUsername,
                service.sshPassword,
                `sudo rm -rfv ${domainPath}/autodeploy/*`
            );
            log.push('Autodeploy:', result.stdout);
        }

        res.json({ 
            success: true, 
            message: 'Manutenção concluída com sucesso',
            log: log.join('\n')
        });
    } catch (error) {
        logger.error('Erro na manutenção:', error);
        res.status(500).json({ 
            error: 'Erro na manutenção',
            details: error.message
        });
    }
});
