const { Server, User, DatabaseCache } = require('../models/postgresql');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const logger = require('../utils/logger'); // Adicionado para logs

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

// Função para verificar se o cache está válido (menos de 1 hora)
function isCacheValid(lastUpdated) {
    const oneHour = 60 * 60 * 1000; // 1 hora em millisegundos
    return Date.now() - new Date(lastUpdated).getTime() < oneHour;
}

// Função para salvar cache de databases
async function saveDatabaseCache(serverId, serverName, serverHost, databases, status, errorMessage = null) {
    try {
        const cacheData = {
            serverId,
            serverName,
            serverHost,
            databases: databases || [],
            status,
            errorMessage,
            totalDatabases: databases ? databases.length : 0,
            lastUpdated: new Date()
        };

        await DatabaseCache.upsert(cacheData, {
            where: { serverId }
        });

        logger.info(`Cache salvo para servidor ${serverName} (${databases ? databases.length : 0} databases)`);
    } catch (error) {
        logger.error(`Erro ao salvar cache para servidor ${serverName}:`, error);
    }
}

// Função para buscar cache de databases
async function getDatabaseCache(serverId) {
    try {
        const cache = await DatabaseCache.findOne({
            where: { serverId },
            order: [['lastUpdated', 'DESC']]
        });

        if (cache && isCacheValid(cache.lastUpdated)) {
            logger.info(`Cache válido encontrado para servidor ${cache.serverName}`);
            return {
                success: true,
                data: {
                    serverId: cache.serverId,
                    serverName: cache.serverName,
                    serverHost: cache.serverHost,
                    success: cache.status === 'success',
                    databases: cache.databases,
                    error: cache.status === 'error' ? cache.errorMessage : null,
                    fromCache: true
                }
            };
        }

        return null;
    } catch (error) {
        logger.error(`Erro ao buscar cache para servidor ${serverId}:`, error);
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
            const totalServers = await Server.count({
                where: { isActive: true }
            });
            
            const activeServers = await Server.count({
                where: { 
                    isActive: true,
                    connectionStatus: 'online'
                }
            });
            
            // Calcular médias de RAM e CPU (placeholder - implementar conforme necessário)
            const averageMemory = 0;
            const averageCpu = 0;
            
            res.json({
                totalServers,
                activeServers,
                averageMemory,
                averageCpu
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
            
            logger.info(`Iniciando listagem de databases para ${serverIds.length} servidores`);
            
            // Buscar servidores
            const servers = await Server.findAll({
                where: { 
                    id: serverIds,
                    isActive: true 
                }
            });
            
            if (servers.length === 0) {
                logger.warn('Nenhum servidor ativo encontrado para os IDs fornecidos');
                return res.status(404).json({
                    success: false,
                    message: 'Nenhum servidor encontrado'
                });
            }
            
            logger.info(`Processando ${servers.length} servidores: ${servers.map(s => s.name).join(', ')}`);
            
            // Processar servidores em paralelo com cache
            const results = await Promise.allSettled(
                servers.map(async (server, index) => {
                    return new Promise(async (resolve) => {
                        logger.info(`[${index + 1}/${servers.length}] Verificando cache para servidor: ${server.name} (${server.host})`);
                        
                        // Verificar cache primeiro
                        const cachedResult = await getDatabaseCache(server.id);
                        if (cachedResult) {
                            logger.info(`[${index + 1}/${servers.length}] Usando cache para ${server.name}`);
                            resolve(cachedResult.data);
                            return;
                        }
                        
                        logger.info(`[${index + 1}/${servers.length}] Cache não encontrado, conectando ao servidor: ${server.name} (${server.host})`);
                        
                        // Timeout de 45 segundos por servidor (aumentado para dar tempo das databases)
                        const timeout = setTimeout(() => {
                            logger.warn(`[${index + 1}/${servers.length}] Timeout ao conectar com ${server.name}`);
                            const errorResult = {
                                serverId: server.id,
                                serverName: server.name,
                                serverHost: server.host,
                                success: false,
                                error: 'Timeout: Conexão excedeu 45 segundos'
                            };
                            
                            // Salvar erro no cache
                            saveDatabaseCache(server.id, server.name, server.host, null, 'error', errorResult.error);
                            resolve(errorResult);
                        }, 45000);
                        
                        try {
                            const decryptedPassword = decryptPassword(server.password);
                            if (!decryptedPassword) {
                                logger.error(`[${index + 1}/${servers.length}] Erro ao descriptografar senha para ${server.name}`);
                                clearTimeout(timeout);
                                resolve({
                                    serverId: server.id,
                                    serverName: server.name,
                                    serverHost: server.host,
                                    success: false,
                                    error: 'Erro ao descriptografar senha'
                                });
                                return;
                            }
                            
                            let sequelize;
                            
                            switch (server.type) {
                                case 'postgresql':
                                    logger.info(`[${index + 1}/${servers.length}] Configurando conexão PostgreSQL para ${server.name}`);
                                    const { Sequelize } = require('sequelize');
                                    sequelize = new Sequelize('postgres', server.username, decryptedPassword, {
                                        host: server.host,
                                        port: server.port,
                                        dialect: 'postgres',
                                        logging: false,
                                        pool: {
                                            max: 1,
                                            min: 0,
                                            acquire: 25000, // Reduzido para 25s
                                            idle: 10000
                                        },
                                        retry: {
                                            max: 1, // Reduzir tentativas
                                            timeout: 20000 // Timeout de 20s
                                        }
                                    });
                                    break;
                                    
                                default:
                                    logger.warn(`[${index + 1}/${servers.length}] Tipo de banco não suportado: ${server.type}`);
                                    clearTimeout(timeout);
                                    resolve({
                                        serverId: server.id,
                                        serverName: server.name,
                                        serverHost: server.host,
                                        success: false,
                                        error: 'Tipo de banco não suportado'
                                    });
                                    return;
                            }
                            
                            logger.info(`[${index + 1}/${servers.length}] Autenticando com ${server.name}...`);
                            await sequelize.authenticate();
                            logger.info(`[${index + 1}/${servers.length}] Conexão estabelecida com ${server.name}`);
                            
                            // Query para listar databases (PostgreSQL) com timeout reduzido
                            logger.info(`[${index + 1}/${servers.length}] Executando query para listar databases em ${server.name}`);
                            const [databases] = await sequelize.query(`
                                SELECT 
                                    d.datname as name,
                                    pg_size_pretty(pg_database_size(d.datname)) as size,
                                    u.usename as owner,
                                    COALESCE(sd.description, '') as comment
                                FROM pg_database d
                                LEFT JOIN pg_user u ON d.datdba = u.usesysid
                                LEFT JOIN pg_shdescription sd ON sd.objoid = d.oid
                                WHERE d.datistemplate = false
                                ORDER BY d.datname
                            `, {
                                timeout: 10000 // Timeout reduzido para 10s
                            });
                            
                            // Buscar versão de cada database em paralelo (máximo 10 conexões simultâneas)
                            logger.info(`[${index + 1}/${servers.length}] Buscando versões das ${databases.length} databases em ${server.name} (paralelo)`);
                            
                            // Processar databases em lotes para evitar sobrecarga
                            const batchSize = 10;
                            const batches = [];
                            for (let i = 0; i < databases.length; i += batchSize) {
                                batches.push(databases.slice(i, i + batchSize));
                            }
                            
                            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                                const batch = batches[batchIndex];
                                logger.info(`[${index + 1}/${servers.length}] Processando lote ${batchIndex + 1}/${batches.length} (${batch.length} databases)`);
                                
                                // Processar lote em paralelo
                                const batchPromises = batch.map(async (db) => {
                                    try {
                                        // Conectar na database específica com timeout reduzido
                                        const dbSequelize = new Sequelize(db.name, server.username, decryptedPassword, {
                                            host: server.host,
                                            port: server.port,
                                            dialect: 'postgres',
                                            logging: false,
                                            pool: {
                                                max: 1,
                                                min: 0,
                                                acquire: 3000, // Reduzido para 3s
                                                idle: 2000
                                            },
                                            retry: {
                                                max: 1,
                                                timeout: 2000
                                            }
                                        });
                                        
                                        // Buscar versão da database com timeout muito reduzido
                                        const [versionResult] = await dbSequelize.query(`
                                            SELECT versaover as version 
                                            FROM public.versao 
                                            WHERE dataver IS NOT NULL 
                                            LIMIT 1
                                        `, {
                                            timeout: 2000 // Timeout de apenas 2s
                                        });
                                        
                                        await dbSequelize.close();
                                        
                                        // Adicionar versão ao resultado
                                        db.version = versionResult.length > 0 ? versionResult[0].version : 'N/A';
                                        
                                    } catch (versionError) {
                                        logger.warn(`[${index + 1}/${servers.length}] Erro ao buscar versão da database ${db.name}: ${versionError.message}`);
                                        db.version = 'N/A';
                                    }
                                });
                                
                                // Aguardar lote atual com timeout
                                await Promise.allSettled(batchPromises);
                            }
                            
                            await sequelize.close();
                            clearTimeout(timeout);
                            
                            logger.info(`[${index + 1}/${servers.length}] ${server.name}: ${databases.length} databases encontradas`);
                            
                            // Log de debug para verificar os dados retornados
                            if (databases.length > 0) {
                                logger.info(`[${index + 1}/${servers.length}] Exemplo de database: ${JSON.stringify(databases[0])}`);
                            }
                            
                            const successResult = {
                                serverId: server.id,
                                serverName: server.name,
                                serverHost: server.host,
                                success: true,
                                databases: databases
                            };
                            
                            // Salvar sucesso no cache
                            await saveDatabaseCache(server.id, server.name, server.host, databases, 'success');
                            resolve(successResult);
                            
                        } catch (error) {
                            clearTimeout(timeout);
                            logger.error(`[${index + 1}/${servers.length}] Erro ao conectar com ${server.name}: ${error.message}`);
                            const errorResult = {
                                serverId: server.id,
                                serverName: server.name,
                                serverHost: server.host,
                                success: false,
                                error: error.message
                            };
                            
                            // Salvar erro no cache
                            await saveDatabaseCache(server.id, server.name, server.host, null, 'error', error.message);
                            resolve(errorResult);
                        }
                    });
                })
            );
            
            // Converter resultados do Promise.allSettled para o formato esperado
            const processedResults = results.map(result => {
                if (result.status === 'fulfilled') {
                    return result.value;
                } else {
                    logger.error('Erro inesperado no processamento:', result.reason);
                    return {
                        serverId: 'unknown',
                        serverName: 'Unknown',
                        serverHost: 'unknown',
                        success: false,
                        error: result.reason?.message || 'Erro desconhecido'
                    };
                }
            });
            
            // Calcular estatísticas finais
            const totalServers = processedResults.length;
            const successfulServers = processedResults.filter(r => r.success).length;
            const totalDatabases = processedResults.reduce((total, server) => {
                return total + (server.success && server.databases ? server.databases.length : 0);
            }, 0);
            
            logger.info(`Listagem concluída: ${successfulServers}/${totalServers} servidores conectados, ${totalDatabases} databases encontradas`);
            
            res.json({
                success: true,
                data: processedResults,
                summary: {
                    totalServers,
                    successfulServers,
                    totalDatabases
                }
            });
            
        } catch (error) {
            logger.error('Erro ao listar databases:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Forçar atualização do cache de databases
    async forceCacheUpdate(req, res) {
        try {
            const { serverIds } = req.body;
            
            if (!serverIds || !Array.isArray(serverIds) || serverIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'IDs dos servidores são obrigatórios'
                });
            }
            
            logger.info(`Forçando atualização de cache para ${serverIds.length} servidores`);
            
            // Limpar cache existente
            await DatabaseCache.destroy({
                where: { serverId: serverIds }
            });
            
            res.json({
                success: true,
                message: 'Cache limpo com sucesso. Execute a consulta novamente para atualizar.'
            });
        } catch (error) {
            logger.error('Erro ao forçar atualização de cache:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = new ServerController(); 