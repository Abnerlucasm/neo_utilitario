const express = require('express');
const router = express.Router();
const { Client } = require('ssh2');
const Glassfish = require('../models/glassfish');
const logger = require('../utils/logger');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const xml2js = require('xml2js');

// Configuração do diretório de uploads
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuração do multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB
    }
});

// Middleware de log
router.use((req, res, next) => {
    logger.info(`[Glassfish Router] ${req.method} ${req.url}`);
    next();
});

// Função para verificar e obter o caminho correto do Glassfish
async function getGlassfishPath(service) {
    const possiblePaths = [
        '/srv/glassfish6.2.5',
        '/opt/glassfish6.2.5',
        '/glassfish6.2.5',
        '/srv/glassfish',
        '/opt/glassfish'
    ];

    for (const basePath of possiblePaths) {
        const checkCommand = `test -d "${basePath}/glassfish/bin" && echo "${basePath}"`;
        try {
            const result = await executeSSHCommand(service, checkCommand);
            if (result.stdout.trim()) {
                // Se encontrou um caminho válido diferente do atual, atualizar no banco
                if (service.installPath !== result.stdout.trim()) {
                    service.installPath = result.stdout.trim();
                    await service.save();
                    logger.info('Caminho do Glassfish atualizado:', {
                        oldPath: service.installPath,
                        newPath: result.stdout.trim()
                    });
                }
                return result.stdout.trim();
            }
        } catch (error) {
            logger.debug(`Caminho ${basePath} não encontrado:`, error);
        }
    }

    throw new Error(`Instalação do Glassfish não encontrada no servidor ${service.ip}`);
}

// Função utilitária para executar comandos SSH com melhor tratamento de erros
async function executeSSHCommand(service, command, timeout = 30000) {
    const ssh = new NodeSSH();
    
    try {
        logger.info(`Tentando conectar via SSH a ${service.ip}`, {
            host: service.ip,
            username: service.sshUsername,
            command: command
        });
        
        await ssh.connect({
            host: service.ip,
            username: service.sshUsername,
            password: service.sshPassword,
            readyTimeout: timeout,
            keepaliveInterval: 10000,
            keepaliveCountMax: 3,
            // Aumentar timeout para conexões lentas
            timeout: 30000
        });

        const result = await ssh.execCommand(command, {
            cwd: '/',
            onStderr: (chunk) => {
                logger.warn('SSH stderr:', chunk.toString('utf8'));
            },
            // Timeout específico para o comando
            timeout: 20000
        });

        // Verificar erros comuns nos comandos
        if (result.stderr && result.stderr.includes('No such file or directory')) {
            throw new Error(`Diretório ou arquivo não encontrado: ${result.stderr}`);
        }

        return {
            code: result.code || 0,
            stdout: result.stdout || '',
            stderr: result.stderr || ''
        };
    } catch (error) {
        logger.error(`Erro SSH para ${service.ip}:`, {
            error: error.message,
            command: command
        });

        // Mensagens de erro mais amigáveis
        if (error.message.includes('ECONNREFUSED')) {
            throw new Error(`Servidor ${service.ip} não está aceitando conexões SSH (porta 22)`);
        } else if (error.message.includes('ETIMEDOUT') || error.message.includes('Timed out')) {
            throw new Error(`Timeout ao conectar com ${service.ip} - servidor pode estar sobrecarregado ou inacessível`);
        } else if (error.message.includes('Authentication failed')) {
            throw new Error(`Falha na autenticação SSH para ${service.ip}`);
        }

        throw error;
    } finally {
        ssh.dispose();
    }
}

// Função auxiliar para verificar status
async function checkGlassfishStatus(service) {
    try {
        const installPath = service.installPath.replace(/\/$/, '');
        
        // 1. Verificar processo Java com o domínio específico
        const pidCommand = `ps aux | grep "[j]ava.*domains/${service.domain}" | grep -v grep | awk '{print $2}'`;
        const pidResult = await executeSSHCommand(service, pidCommand);
        const pid = pidResult.stdout.trim();

        if (pid) {
            // 2. Verificar se o processo está realmente respondendo
            const portCommand = `netstat -tlpn 2>/dev/null | grep "${pid}/java" | grep -q "LISTEN"`;
            try {
                await executeSSHCommand(service, portCommand);
                
                // 3. Verificar com asadmin list-domains para confirmação extra
                const statusCommand = `
                    cd ${installPath}/glassfish/bin &&
                    ./asadmin list-domains | grep "${service.domain}"
                `;
                const domainStatus = await executeSSHCommand(service, statusCommand);
                
                // Se o processo existe e a porta está escutando, consideramos ativo
                return {
                    status: 'active',
                    pid: parseInt(pid),
                    details: {
                        asadminStatus: domainStatus.stdout.trim()
                    }
                };
            } catch (portError) {
                logger.warn(`Processo existe mas porta não está escutando para ${service.name}:`, portError);
                return {
                    status: 'inactive',
                    pid: parseInt(pid),
                    details: {
                        error: 'port_not_listening'
                    }
                };
            }
        }

        // Se não encontrou processo, tentar uma última verificação com asadmin
        const finalCheck = `
            cd ${installPath}/glassfish/bin &&
            ./asadmin list-domains | grep "${service.domain}"
        `;
        
        try {
            const finalResult = await executeSSHCommand(service, finalCheck);
            const isRunning = finalResult.stdout.includes(`${service.domain} running`);
            
            if (isRunning) {
                // Se asadmin diz que está rodando mas não achamos o processo, algo está errado
                logger.warn(`Status inconsistente para ${service.name}: asadmin diz running mas processo não encontrado`);
                return {
                    status: 'error',
                    pid: null,
                    details: {
                        error: 'inconsistent_state',
                        asadminStatus: finalResult.stdout.trim()
                    }
                };
            }
        } catch (finalError) {
            logger.debug(`Verificação final falhou para ${service.name}:`, finalError);
        }

        return {
            status: 'inactive',
            pid: null
        };
    } catch (error) {
        logger.error('Erro ao verificar status:', {
            service: service.name,
            error: error.message
        });
        return {
            status: 'error',
            pid: null,
            details: {
                error: 'check_failed',
                message: error.message
            }
        };
    }
}

// Função para ler o domain.xml
async function tryReadDomainXml(service) {
    const domainPath = `${service.installPath}/glassfish/domains/${service.domain}/config/domain.xml`;
    const command = `cat "${domainPath}"`;
    
    try {
        const result = await executeSSHCommand(service, command);
        
        if (result.code !== 0 || !result.stdout) {
            throw new Error('Erro ao ler domain.xml: ' + (result.stderr || 'Arquivo não encontrado'));
        }

        return {
            stdout: result.stdout,
            filePath: domainPath
        };
    } catch (error) {
        logger.error('Erro ao ler domain.xml:', {
            error: error.message,
            path: domainPath,
            service: service.name
        });
        throw error;
    }
}

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

// Rotas CRUD principais
router.get('/servicos', async (req, res) => {
    try {
        const services = await Glassfish.find();
        res.json(services);
    } catch (error) {
        logger.error('Erro ao listar serviços:', error);
        res.status(500).json({ error: 'Erro ao listar serviços' });
    }
});

router.post('/servicos', async (req, res) => {
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
            categoria
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
            categoria: categoria || 'Cliente'
        });

        await newService.save();
        res.status(201).json(newService);
    } catch (err) {
        logger.error('Erro ao criar serviço:', {
            error: err.message,
            stack: err.stack,
            validationErrors: err.errors
        });

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

router.put('/servicos/:id', async (req, res) => {
    try {
        const allowedUpdates = [
            'name', 'ip', 'port', 'domain', 'password', 
            'sshUsername', 'sshPassword', 'installPath', 
            'status', 'categoria'
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
        logger.error('Erro ao atualizar serviço:', err);
        res.status(500).json({ 
            error: 'Erro ao atualizar serviço',
            details: err.message 
        });
    }
});

router.delete('/servicos/:id', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ 
                error: 'Serviço não encontrado',
                details: 'O serviço solicitado não existe ou já foi removido'
            });
        }

        logger.info('Removendo serviço:', {
            id: service._id,
            name: service.name,
            ip: service.ip
        });

        await Glassfish.findByIdAndDelete(req.params.id);
        
        logger.info('Serviço removido com sucesso');
        
        res.json({ 
            message: 'Serviço removido com sucesso',
            details: {
                name: service.name,
                id: service._id
            }
        });
    } catch (error) {
        logger.error('Erro ao deletar serviço:', {
            id: req.params.id,
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).json({ 
            error: 'Erro ao deletar serviço',
            details: error.message
        });
    }
});

// Rota para verificar status
router.get('/servicos/:id/status', async (req, res) => {
    let service;
    try {
        service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        // Verificar e atualizar o caminho do Glassfish se necessário
        try {
            await getGlassfishPath(service);
        } catch (pathError) {
            return res.json({
                status: 'error',
                pid: null,
                details: {
                    error: 'installation_not_found',
                    message: pathError.message
                }
            });
        }

        const status = await checkGlassfishStatus(service);
        
        // Atualizar status no banco apenas se não for um erro
        if (status.status !== 'error') {
            service.status = status.status;
            service.pid = status.pid;
            await service.save();
        }

        res.json(status);
    } catch (error) {
        logger.error('Erro ao verificar status:', error);
        res.status(500).json({ 
            error: 'Erro ao verificar status',
            details: error.message
        });
    }
});

// Função auxiliar para coletar estatísticas de um servidor
async function collectServerStats(service) {
    try {
        // Verificar se o serviço está ativo
        const status = await checkGlassfishStatus(service);
        if (status.status !== 'active') {
            return {
                memory: 0,
                cpu: 0
            };
        }

        // Coletar estatísticas de RAM
        const memoryCommand = `
            ps -o rss= -p $(ps aux | grep "[j]ava.*${service.domain}" | awk '{print $2}') | \
            awk '{print int($1/1024/$(free -m | grep Mem | awk "{print $2}")*100)}'
        `;
        const memoryResult = await executeSSHCommand(service, memoryCommand);
        const memoryUsage = parseInt(memoryResult.stdout) || 0;

        // Coletar estatísticas de CPU
        const cpuCommand = `
            ps -p $(ps aux | grep "[j]ava.*${service.domain}" | awk '{print $2}') -o %cpu= | \
            awk '{print int($1)}'
        `;
        const cpuResult = await executeSSHCommand(service, cpuCommand);
        const cpuUsage = parseInt(cpuResult.stdout) || 0;

        return {
            memory: memoryUsage,
            cpu: cpuUsage
        };
    } catch (error) {
        logger.error(`Erro ao coletar estatísticas para ${service.name}:`, error);
        return {
            memory: 0,
            cpu: 0
        };
    }
}

// Rota para estatísticas
router.get('/servicos/stats/overview', async (req, res) => {
    try {
        const services = await Glassfish.find();
        const activeServices = services.filter(s => s.status === 'active');
        
        // Array para armazenar as promessas de coleta de estatísticas
        const statsPromises = activeServices.map(async service => {
            try {
                // Comando para obter uso de RAM
                const memoryCommand = `free -m | grep Mem | awk '{print int($3/$2 * 100)}'`;
                const memoryResult = await executeSSHCommand(service, memoryCommand);
                const memoryUsage = parseInt(memoryResult.stdout) || 0;

                // Comando para obter uso de CPU
                const cpuCommand = `top -bn1 | grep "Cpu(s)" | awk '{print int($2)}'`;
                const cpuResult = await executeSSHCommand(service, cpuCommand);
                const cpuUsage = parseInt(cpuResult.stdout) || 0;

                return {
                    id: service._id,
                    name: service.name,
                    status: service.status,
                    memory: memoryUsage,
                    cpu: cpuUsage
                };
            } catch (error) {
                logger.error(`Erro ao coletar estatísticas para ${service.name}:`, error);
                return {
                    id: service._id,
                    name: service.name,
                    status: service.status,
                    memory: 0,
                    cpu: 0
                };
            }
        });

        // Aguardar todas as coletas de estatísticas
        const serverDetails = await Promise.all(statsPromises);

        // Calcular médias
        const totalMemory = serverDetails.reduce((sum, server) => sum + server.memory, 0);
        const totalCpu = serverDetails.reduce((sum, server) => sum + server.cpu, 0);
        const activeCount = serverDetails.length || 1; // Evitar divisão por zero

        const stats = {
            totalServers: services.length,
            activeServers: activeServices.length,
            averageMemory: Math.round(totalMemory / activeCount),
            averageCpu: Math.round(totalCpu / activeCount),
            serverDetails: serverDetails
        };

        res.json(stats);
    } catch (error) {
        logger.error('Erro ao obter estatísticas:', error);
        res.status(500).json({ 
            error: 'Erro ao obter estatísticas',
            details: error.message
        });
    }
});

// Rotas de logs
router.get('/servicos/:id/logs', async (req, res) => {
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
router.get('/servicos/:id/logs/live', (req, res) => {
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

// Rotas de configuração
router.get('/servicos/:id/domain-config', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        try {
            const result = await tryReadDomainXml(service);
            const parser = new xml2js.Parser({
                explicitArray: true,
                mergeAttrs: false,
                attrkey: '$'
            });

            const xmlData = await parser.parseStringPromise(result.stdout);
            
            // Verificar se as estruturas necessárias existem
            if (!xmlData.domain?.resources?.[0]?.['jdbc-connection-pool']) {
                throw new Error('Estrutura do XML inválida: jdbc-connection-pool não encontrado');
            }

            const resources = xmlData.domain.resources[0];
            const jdbcPools = resources['jdbc-connection-pool'];
            const pool = jdbcPools.find(p => p.$.name === 'Pg_Neocorp_Pool');

            if (!pool) {
                throw new Error('Pool Pg_Neocorp_Pool não encontrado');
            }

            const config = {
                serverName: '',
                user: '',
                password: '',
                databaseName: ''
            };

            if (pool.property) {
                pool.property.forEach(prop => {
                    if (prop && prop.$) {
                        switch (prop.$.name) {
                            case 'serverName':
                                config.serverName = prop.$.value;
                                break;
                            case 'user':
                                config.user = prop.$.value;
                                break;
                            case 'password':
                                config.password = prop.$.value;
                                break;
                            case 'databaseName':
                                config.databaseName = prop.$.value;
                                break;
                        }
                    }
                });
            }

            res.json(config);
        } catch (xmlError) {
            logger.error('Erro ao processar domain.xml:', {
                error: xmlError.message,
                service: service.name
            });
            
            res.status(500).json({
                error: 'Erro ao processar configurações',
                details: xmlError.message
            });
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
router.put('/servicos/:id/domain-config', async (req, res) => {
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

// Rotas de aplicações
router.get('/servicos/:id/applications', async (req, res) => {
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
            const applications = [];
            
            if (xmlData.domain?.applications?.[0]?.application) {
                xmlData.domain.applications[0].application.forEach(app => {
                    if (app.$['object-type'] === 'user') {
                        applications.push({
                            name: app.$.name,
                            engine: app.$['enable'] === 'true' ? 'enabled' : 'disabled',
                            status: 'deployed',
                            location: app.$.location || `${installPath}/glassfish/domains/${service.domain}/applications/${app.$.name}`
                        });
                    }
                });
            }

            res.json({
                status: 'success',
                applications: applications
            });

        } catch (parseError) {
            logger.error('Erro ao processar XML:', {
                error: parseError.message,
                service: service.name
            });
            
            res.status(500).json({
                error: 'Erro ao processar configurações',
                details: parseError.message
            });
        }
    } catch (error) {
        logger.error('Erro ao listar aplicações:', {
            error: error.message,
            service: service?.name
        });
        
        res.status(500).json({ 
            error: 'Erro ao listar aplicações',
            details: error.message
        });
    }
});

// Rota para parar o serviço
router.post('/servicos/:id/stop', async (req, res) => {
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
router.post('/servicos/:id/upload-application', upload.single('file'), async (req, res) => {
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

// Rota para testar conexão SSH
router.post('/test-ssh', async (req, res) => {
    try {
        const { ip, username, password } = req.body;
        
        if (!ip || !username || !password) {
            return res.status(400).json({
                error: 'Parâmetros incompletos',
                details: 'IP, usuário e senha são obrigatórios'
            });
        }

        const ssh = new NodeSSH();
        
        await ssh.connect({
            host: ip,
            username: username,
            password: password,
            readyTimeout: 5000,
            keepaliveInterval: 10000
        });

        // Executar um comando simples para testar
        const result = await ssh.execCommand('echo "SSH test successful"');
        
        res.json({
            success: true,
            message: 'Conexão SSH estabelecida com sucesso',
            details: result.stdout
        });
    } catch (error) {
        logger.error('Erro no teste SSH:', {
            error: error.message,
            host: ip
        });

        let errorMessage = 'Erro na conexão SSH';
        if (error.message.includes('ECONNREFUSED')) {
            errorMessage = `Servidor ${ip} não está aceitando conexões SSH (porta 22)`;
        } else if (error.message.includes('ETIMEDOUT')) {
            errorMessage = `Timeout ao conectar com ${ip}`;
        } else if (error.message.includes('Authentication failed')) {
            errorMessage = `Falha na autenticação SSH para ${ip}`;
        }

        res.status(500).json({
            success: false,
            error: errorMessage,
            details: error.message
        });
    }
});

// Exportar o router
module.exports = router; 