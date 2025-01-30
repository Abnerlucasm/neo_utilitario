const express = require('express');
const router = express.Router();
const { Client } = require('ssh2');
const Glassfish = require('../models/glassfish');

// Função utilitária para executar comandos SSH com timeout
async function executeSSHCommand(service, command, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        let timeoutId;

        // Configurar timeout
        timeoutId = setTimeout(() => {
            conn.end();
            reject(new Error('Timeout na execução do comando SSH'));
        }, timeout);

        conn.on('ready', () => {
            conn.exec(command, (err, stream) => {
                if (err) {
                    clearTimeout(timeoutId);
                    conn.end();
                    reject(err);
                    return;
                }

                let output = '';
                let errorOutput = '';

                stream.on('data', (data) => {
                    output += data;
                });

                stream.stderr.on('data', (data) => {
                    errorOutput += data;
                });

                stream.on('close', (code) => {
                    clearTimeout(timeoutId);
                    conn.end();
                    if (code === 0) {
                        resolve(output.trim());
                    } else {
                        reject(new Error(errorOutput || `Comando falhou com código ${code}`));
                    }
                });
            });
        });

        conn.on('error', (err) => {
            clearTimeout(timeoutId);
            reject(err);
        });

        // Tentar conectar com as credenciais do serviço
        conn.connect({
            host: service.ip,
            username: service.sshUsername,
            password: service.sshPassword,
            readyTimeout: 5000,
            keepaliveInterval: 2000
        });
    });
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

// Rota para verificar status de um serviço específico
router.post('/servicos/:id/status', async (req, res) => {
    try {
        const service = await Glassfish.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        // Verifica se todas as credenciais necessárias estão presentes
        if (!service.ip || !service.sshUsername || !service.sshPassword || !service.domain) {
            return res.status(400).json({ 
                error: 'Credenciais incompletas',
                details: 'IP, usuário SSH, senha SSH e domínio são obrigatórios'
            });
        }

        // Comando para verificar o processo do domínio específico
        const pidCommand = `ps aux | grep "${service.domain}" | grep -v grep | awk '{print $2}'`;
        
        try {
            const pid = await executeSSHCommand(service, pidCommand);
            
            // Atualiza o status do serviço no banco de dados
            service.status = pid ? 'active' : 'inactive';
            if (pid) {
                service.pid = parseInt(pid);
            }
            await service.save();

            res.json({
                status: pid ? 'ativo' : 'inativo',
                pid: pid ? parseInt(pid) : null
            });
        } catch (sshError) {
            console.error('Erro na execução do comando SSH:', sshError);
            // Em caso de erro de conexão SSH, mantemos o status atual
            res.json({
                status: service.status,
                pid: service.pid,
                warning: 'Não foi possível verificar o status atual via SSH'
            });
        }
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        res.status(500).json({ 
            error: 'Erro ao verificar status do serviço',
            details: error.message 
        });
    }
});

// Rota para estatísticas gerais
router.get('/servicos/stats/overview', async (req, res) => {
    try {
        const services = await Glassfish.find({ status: 'active' });
        console.log('Serviços encontrados:', services.length);

        const statsPromises = services.map(async (service) => {
            try {
                const [memory, cpu] = await Promise.all([
                    executeSSHCommand(service, "free -m | grep 'Mem:' | awk '{print int($3/$2 * 100)}'"),
                    executeSSHCommand(service, "top -bn1 | grep 'Cpu(s)' | awk '{print int($2)}'")
                ]);

                return {
                    name: service.name,
                    memory: parseInt(memory) || 0,
                    cpu: parseInt(cpu) || 0
                };
            } catch (error) {
                console.error(`Erro ao coletar estatísticas para ${service.name}:`, error);
                return null;
            }
        });

        const allStats = (await Promise.all(statsPromises)).filter(Boolean);
        
        const overview = {
            totalServers: services.length,
            activeServers: allStats.length,
            averageMemory: allStats.length > 0 
                ? Math.round(allStats.reduce((acc, stat) => acc + stat.memory, 0) / allStats.length) 
                : 0,
            averageCpu: allStats.length > 0 
                ? Math.round(allStats.reduce((acc, stat) => acc + stat.cpu, 0) / allStats.length) 
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

module.exports = router; 