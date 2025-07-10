const { Server, User } = require('../models/postgresql');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');

// Chave para criptografia (em produção, deve estar em variável de ambiente)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secret-key-32-chars-long!';

// Função para criptografar senha
function encryptPassword(password) {
    const iv = crypto.randomBytes(16);
    // Garantir que a chave tenha exatamente 32 bytes (256 bits)
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

// Função para descriptografar senha
function decryptPassword(encryptedPassword) {
    try {
        const parts = encryptedPassword.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        // Garantir que a chave tenha exatamente 32 bytes (256 bits)
        const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Erro ao descriptografar senha:', error);
        return null;
    }
}

// Função para testar conexão com banco de dados
async function testDatabaseConnection(serverData) {
    const { host, port, username, password, type } = serverData;
    
    try {
        let sequelize;
        
        switch (type) {
            case 'postgresql':
                const { Sequelize } = require('sequelize');
                sequelize = new Sequelize('postgres', username, decryptPassword(password), {
                    host,
                    port,
                    dialect: 'postgres',
                    logging: false,
                    pool: {
                        max: 1,
                        min: 0,
                        acquire: 30000,
                        idle: 10000
                    }
                });
                break;
                
            case 'mysql':
                const { Sequelize: MySQLSequelize } = require('sequelize');
                sequelize = new MySQLSequelize('mysql', username, decryptPassword(password), {
                    host,
                    port,
                    dialect: 'mysql',
                    logging: false,
                    pool: {
                        max: 1,
                        min: 0,
                        acquire: 30000,
                        idle: 10000
                    }
                });
                break;
                
            case 'sqlserver':
                const { Sequelize: MSSQLSequelize } = require('sequelize');
                sequelize = new MSSQLSequelize('master', username, decryptPassword(password), {
                    host,
                    port,
                    dialect: 'mssql',
                    logging: false,
                    pool: {
                        max: 1,
                        min: 0,
                        acquire: 30000,
                        idle: 10000
                    }
                });
                break;
                
            default:
                throw new Error('Tipo de banco de dados não suportado');
        }
        
        await sequelize.authenticate();
        await sequelize.close();
        
        return { success: true, message: 'Conexão estabelecida com sucesso' };
    } catch (error) {
        return { 
            success: false, 
            message: `Erro na conexão: ${error.message}` 
        };
    }
}

// Função para executar consulta em múltiplos servidores
async function executeQueryOnServers(servers, query) {
    const results = [];
    
    for (const server of servers) {
        try {
            const decryptedPassword = decryptPassword(server.password);
            if (!decryptedPassword) {
                results.push({
                    serverId: server.id,
                    serverName: server.name,
                    success: false,
                    error: 'Erro ao descriptografar senha'
                });
                continue;
            }
            
            let sequelize;
            
            switch (server.type) {
                case 'postgresql':
                    const { Sequelize } = require('sequelize');
                    sequelize = new Sequelize('postgres', server.username, decryptedPassword, {
                        host: server.host,
                        port: server.port,
                        dialect: 'postgres',
                        logging: false,
                        pool: {
                            max: 1,
                            min: 0,
                            acquire: 30000,
                            idle: 10000
                        }
                    });
                    break;
                    
                default:
                    results.push({
                        serverId: server.id,
                        serverName: server.name,
                        success: false,
                        error: 'Tipo de banco não suportado'
                    });
                    continue;
            }
            
            await sequelize.authenticate();
            const [queryResults] = await sequelize.query(query);
            await sequelize.close();
            
            results.push({
                serverId: server.id,
                serverName: server.name,
                success: true,
                data: queryResults
            });
            
        } catch (error) {
            results.push({
                serverId: server.id,
                serverName: server.name,
                success: false,
                error: error.message
            });
        }
    }
    
    return results;
}

class ServerController {
    // Listar todos os servidores
    async listServers(req, res) {
        try {
            const servers = await Server.findAll({
                where: { isActive: true },
                include: [
                    {
                        model: User,
                        as: 'creator',
                        attributes: ['id', 'name', 'email']
                    }
                ],
                order: [['name', 'ASC']]
            });
            
            res.json({
                success: true,
                data: servers
            });
        } catch (error) {
            console.error('Erro ao listar servidores:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    
    // Obter servidor por ID
    async getServer(req, res) {
        try {
            const { id } = req.params;
            const server = await Server.findByPk(id, {
                include: [
                    {
                        model: User,
                        as: 'creator',
                        attributes: ['id', 'name', 'email']
                    }
                ]
            });
            
            if (!server) {
                return res.status(404).json({
                    success: false,
                    message: 'Servidor não encontrado'
                });
            }
            
            res.json({
                success: true,
                data: server
            });
        } catch (error) {
            console.error('Erro ao obter servidor:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    
    // Criar novo servidor
    async createServer(req, res) {
        try {
            const {
                name,
                host,
                port,
                username,
                password,
                type,
                description
            } = req.body;
            
            // Validar dados obrigatórios
            if (!name || !host || !username || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Nome, host, usuário e senha são obrigatórios'
                });
            }
            
            // Criptografar senha
            const encryptedPassword = encryptPassword(password);
            
            // Verificar se já existe servidor com mesmo host e porta
            const existingServer = await Server.findOne({
                where: { host, port: port || 5432 }
            });
            
            if (existingServer) {
                return res.status(400).json({
                    success: false,
                    message: 'Já existe um servidor cadastrado com este host e porta'
                });
            }
            
            // Criar servidor sem testar conexão automaticamente
            const server = await Server.create({
                name,
                host,
                port: port || 5432,
                username,
                password: encryptedPassword,
                type: type || 'postgresql',
                description,
                createdBy: req.user.id,
                connectionStatus: 'offline' // Inicialmente offline até testar
            });
            
            res.status(201).json({
                success: true,
                message: 'Servidor criado com sucesso',
                data: server
            });
        } catch (error) {
            console.error('Erro ao criar servidor:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    
    // Atualizar servidor
    async updateServer(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            
            const server = await Server.findByPk(id);
            if (!server) {
                return res.status(404).json({
                    success: false,
                    message: 'Servidor não encontrado'
                });
            }
            
            // Se a senha foi fornecida, criptografar
            if (updateData.password) {
                updateData.password = encryptPassword(updateData.password);
            }
            
            updateData.updatedBy = req.user.id;
            // Não alterar o status de conexão automaticamente
            
            await server.update(updateData);
            
            res.json({
                success: true,
                message: 'Servidor atualizado com sucesso',
                data: server
            });
        } catch (error) {
            console.error('Erro ao atualizar servidor:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    
    // Deletar servidor (soft delete)
    async deleteServer(req, res) {
        try {
            const { id } = req.params;
            
            const server = await Server.findByPk(id);
            if (!server) {
                return res.status(404).json({
                    success: false,
                    message: 'Servidor não encontrado'
                });
            }
            
            await server.destroy();
            
            res.json({
                success: true,
                message: 'Servidor removido com sucesso'
            });
        } catch (error) {
            console.error('Erro ao deletar servidor:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    
    // Testar conexão de um servidor
    async testConnection(req, res) {
        try {
            const { id } = req.params;
            
            const server = await Server.findByPk(id);
            if (!server) {
                return res.status(404).json({
                    success: false,
                    message: 'Servidor não encontrado'
                });
            }
            
            const result = await testDatabaseConnection(server);
            
            // Atualizar status da conexão
            await server.update({
                connectionStatus: result.success ? 'online' : 'error',
                lastConnection: new Date()
            });
            
            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Erro ao testar conexão:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    
    // Executar consulta em múltiplos servidores
    async executeQuery(req, res) {
        try {
            const { query, serverIds } = req.body;
            
            if (!query || !serverIds || !Array.isArray(serverIds)) {
                return res.status(400).json({
                    success: false,
                    message: 'Query e lista de servidores são obrigatórios'
                });
            }
            
            // Buscar servidores ativos
            const servers = await Server.findAll({
                where: {
                    id: serverIds,
                    isActive: true
                }
            });
            
            if (servers.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Nenhum servidor válido encontrado'
                });
            }
            
            const results = await executeQueryOnServers(servers, query);
            
            res.json({
                success: true,
                data: results
            });
        } catch (error) {
            console.error('Erro ao executar consulta:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    
    // Obter estatísticas dos servidores
    async getServerStats(req, res) {
        try {
            const stats = await Server.findAll({
                attributes: [
                    'connectionStatus',
                    [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
                ],
                where: { isActive: true },
                group: ['connectionStatus']
            });
            
            const totalServers = await Server.count({
                where: { isActive: true }
            });
            
            res.json({
                success: true,
                data: {
                    stats,
                    totalServers
                }
            });
        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Listar databases dos servidores
    async listDatabases(req, res) {
        try {
            const { serverIds } = req.body;
            
            if (!serverIds || !Array.isArray(serverIds) || serverIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'IDs dos servidores são obrigatórios'
                });
            }
            
            // Buscar servidores
            const servers = await Server.findAll({
                where: { 
                    id: serverIds,
                    isActive: true 
                }
            });
            
            if (servers.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Nenhum servidor encontrado'
                });
            }
            
            const results = [];
            
            for (const server of servers) {
                try {
                    const decryptedPassword = decryptPassword(server.password);
                    if (!decryptedPassword) {
                        results.push({
                            serverId: server.id,
                            serverName: server.name,
                            serverHost: server.host,
                            success: false,
                            error: 'Erro ao descriptografar senha'
                        });
                        continue;
                    }
                    
                    let sequelize;
                    
                    switch (server.type) {
                        case 'postgresql':
                            const { Sequelize } = require('sequelize');
                            sequelize = new Sequelize('postgres', server.username, decryptedPassword, {
                                host: server.host,
                                port: server.port,
                                dialect: 'postgres',
                                logging: false,
                                pool: {
                                    max: 1,
                                    min: 0,
                                    acquire: 30000,
                                    idle: 10000
                                }
                            });
                            break;
                            
                        default:
                            results.push({
                                serverId: server.id,
                                serverName: server.name,
                                success: false,
                                error: 'Tipo de banco não suportado'
                            });
                            continue;
                    }
                    
                    await sequelize.authenticate();
                    
                    // Query para listar databases (PostgreSQL)
                    const [databases] = await sequelize.query(`
                        SELECT 
                            d.datname as name,
                            pg_size_pretty(pg_database_size(d.datname)) as size,
                            u.usename as owner
                        FROM pg_database d
                        LEFT JOIN pg_user u ON d.datdba = u.usesysid
                        WHERE d.datistemplate = false
                        ORDER BY d.datname
                    `);
                    
                    await sequelize.close();
                    
                    results.push({
                        serverId: server.id,
                        serverName: server.name,
                        serverHost: server.host,
                        success: true,
                        databases: databases
                    });
                    
                } catch (error) {
                    results.push({
                        serverId: server.id,
                        serverName: server.name,
                        serverHost: server.host,
                        success: false,
                        error: error.message
                    });
                }
            }
            
            res.json({
                success: true,
                data: results
            });
            
        } catch (error) {
            console.error('Erro ao listar databases:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = new ServerController(); 