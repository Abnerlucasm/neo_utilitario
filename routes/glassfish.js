const express = require('express');
const router = express.Router();
const { Client } = require('ssh2');
const Glassfish = require('../models/glassfish');
const logger = require('../utils/logger');

// Adicionar middleware de log no router
router.use((req, res, next) => {
    logger.info(`[Glassfish Router] ${req.method} ${req.url}`);
    next();
});

// Função utilitária para executar comandos SSH com timeout
async function executeSSHCommand(service, command, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        let timeoutId;

        // Configurar timeout
        timeoutId = setTimeout(() => {
            conn.end();
            reject(new Error(`Timeout após ${timeout/1000} segundos na execução do comando SSH`));
        }, timeout);

        conn.on('ready', () => {
            conn.exec(command, (err, stream) => {
                if (err) {
                    clearTimeout(timeoutId);
                    conn.end();
                    reject(err);
                    return;
                }

                let stdout = '';
                let stderr = '';

                stream.on('data', (data) => {
                    stdout += data;
                });

                stream.stderr.on('data', (data) => {
                    stderr += data;
                });

                stream.on('close', (code) => {
                    clearTimeout(timeoutId);
                    conn.end();
                    resolve({ code, stdout, stderr });
                });
            });
        });

        conn.on('error', (err) => {
            clearTimeout(timeoutId);
            reject(err);
        });

        conn.connect({
            host: service.ip,
            username: service.sshUsername,
            password: service.sshPassword
        });
    });
}

// Função auxiliar para verificar status
async function checkGlassfishStatus(service) {
    try {
        // Primeiro verificar com asadmin list-domains
        const statusCommand = `
            cd ${service.installPath}/glassfish/bin &&
            ./asadmin list-domains | grep "${service.domain}"
        `;
        const domainStatus = await executeSSHCommand(service, statusCommand);
        const isActive = domainStatus.stdout.includes(`${service.domain} running`);

        if (isActive) {
            // Se está ativo, buscar o PID
            const pidCommand = `ps aux | grep "[j]ava.*domains/${service.domain}/config/domain.xml" | grep -v grep | awk '{print $2}'`;
            const pidResult = await executeSSHCommand(service, pidCommand);
            const pid = pidResult.stdout.trim();

            return {
                status: 'active',
                pid: pid ? parseInt(pid) : null
            };
        }

        return {
            status: 'inactive',
            pid: null
        };
    } catch (error) {
        logger.error('Erro ao verificar status:', error);
        return {
            status: 'inactive',
            pid: null
        };
    }
}

// Rota para listar todos os serviços
router.get('/servicos', async (req, res) => {
    try {
        const services = await Glassfish.find();
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar serviços' });
    }
});

// Rota para verificar status
router.get('/servicos/:id/status', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        const status = await checkGlassfishStatus(service);
        service.status = status.status;
        service.pid = status.pid;
        await service.save();

        res.json(status);
    } catch (error) {
        logger.error('Erro ao verificar status:', error);
        res.status(500).json({ 
            error: 'Erro ao verificar status do serviço',
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

        // Primeiro verificar se o domínio está realmente rodando
        const status = await checkGlassfishStatus(service);
        if (status.status !== 'active') {
            return res.json({ message: 'Serviço já está parado' });
        }

        const stopCommand = `
            cd ${service.installPath}/glassfish/bin &&
            echo '${service.sshPassword}' | sudo -S ./asadmin stop-domain ${service.domain}
        `;
        
        const result = await executeSSHCommand(service, stopCommand);
        logger.info('Resultado do comando stop:', result);

        if (result.code !== 0) {
            throw new Error(result.stderr || 'Erro ao parar serviço');
        }

        // Verificar novamente o status após tentar parar
        const newStatus = await checkGlassfishStatus(service);
        service.status = newStatus.status;
        service.pid = newStatus.pid;
        await service.save();

        res.json({ 
            message: 'Serviço parado com sucesso',
            status: newStatus.status
        });
    } catch (error) {
        logger.error('Erro ao parar serviço:', error);
        res.status(500).json({
            error: 'Erro ao parar serviço',
            details: error.message
        });
    }
});

// Rota para iniciar o serviço
router.post('/servicos/:id/start', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        // Verificar se o serviço já está rodando
        const currentStatus = await checkGlassfishStatus(service);
        if (currentStatus.status === 'active') {
            return res.json({ 
                message: 'Serviço já está rodando',
                status: currentStatus.status,
                pid: currentStatus.pid
            });
        }

        // Comando modificado para usar sudo diretamente
        const startCommand = `
            cd ${service.installPath}/glassfish/bin &&
            echo '${service.sshPassword}' | sudo -S ./asadmin start-domain --domaindir ${service.installPath}/glassfish/domains ${service.domain}
        `;
        
        const result = await executeSSHCommand(service, startCommand);
        logger.info('Resultado do comando start:', {
            command: startCommand,
            result: result
        });

        if (result.code !== 0) {
            throw new Error(result.stderr || 'Erro ao iniciar serviço');
        }

        // Aguardar um momento para o serviço iniciar completamente
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verificar novamente o status
        const newStatus = await checkGlassfishStatus(service);
        service.status = newStatus.status;
        service.pid = newStatus.pid;
        await service.save();

        res.json({ 
            message: 'Serviço iniciado com sucesso', 
            status: newStatus.status,
            pid: newStatus.pid 
        });
    } catch (error) {
        logger.error('Erro ao iniciar serviço:', error);
        res.status(500).json({ 
            error: 'Erro ao iniciar serviço', 
            details: error.message 
        });
    }
});

// Rota para estatísticas gerais
router.get('/servicos/stats/overview', async (req, res) => {
    try {
        const services = await Glassfish.find();
        console.log('Serviços encontrados:', services.length);

        const statsPromises = services.map(async (service) => {
            try {
                // Verificar status primeiro
                const statusCommand = `ps aux | grep "[j]ava.*domains/${service.domain}" | grep -v grep`;
                const statusResult = await executeSSHCommand(service, statusCommand);
                const isActive = statusResult.stdout.trim().length > 0;

                if (!isActive) {
                    return {
                        name: service.name,
                        status: 'inactive',
                        memory: 0,
                        cpu: 0
                    };
                }

                const [memory, cpu] = await Promise.all([
                    executeSSHCommand(service, "free -m | grep 'Mem:' | awk '{print int($3/$2 * 100)}'"),
                    executeSSHCommand(service, "top -bn1 | grep 'Cpu(s)' | awk '{print int($2)}'")
                ]);

                return {
                    name: service.name,
                    status: 'active',
                    memory: parseInt(memory.stdout) || 0,
                    cpu: parseInt(cpu.stdout) || 0
                };
            } catch (error) {
                console.error(`Erro ao coletar estatísticas para ${service.name}:`, error);
                return {
                    name: service.name,
                    status: 'inactive',
                    memory: 0,
                    cpu: 0
                };
            }
        });

        const allStats = await Promise.all(statsPromises);
        const activeServers = allStats.filter(stat => stat.status === 'active');
        
        const overview = {
            totalServers: services.length,
            activeServers: activeServers.length,
            inactiveServers: services.length - activeServers.length,
            averageMemory: activeServers.length > 0 
                ? Math.round(activeServers.reduce((acc, stat) => acc + stat.memory, 0) / activeServers.length) 
                : 0,
            averageCpu: activeServers.length > 0 
                ? Math.round(activeServers.reduce((acc, stat) => acc + stat.cpu, 0) / activeServers.length) 
                : 0,
            serverDetails: allStats
        };

        res.json(overview);
    } catch (error) {
        console.error('Erro ao coletar visão geral:', error);
        res.status(500).json({ 
            error: 'Erro ao coletar estatísticas gerais',
            details: error.message 
        });
    }
});

// Exportar o router
module.exports = router; 