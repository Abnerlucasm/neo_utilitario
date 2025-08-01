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
                        acquire: 15000,
                        idle: 5000
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
                            max: 5,
                            min: 0,
                            acquire: 15000,
                            idle: 5000
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

// Função para processar servidores em background (progressivo)
async function processServersProgressive(sessionId) {
    const session = global.progressiveSessions[sessionId];
    if (!session) return;
    
    try {
        for (let i = 0; i < session.servers.length; i++) {
            const server = session.servers[i];
            
            // Verificar cache primeiro
            logger.info(`[${i + 1}/${session.servers.length}] Verificando cache para servidor: ${server.name}`);
            const cachedResult = await getDatabaseCache(server.id);
            if (cachedResult) {
                logger.info(`[${i + 1}/${session.servers.length}] Usando cache para ${server.name}`);
                session.results.push(cachedResult.data);
                session.completed++;
                continue;
            }
            
            logger.info(`[${i + 1}/${session.servers.length}] Cache não encontrado, conectando ao servidor: ${server.name}`);
            
            try {
                const decryptedPassword = decryptPassword(server.password);
                if (!decryptedPassword) {
                    session.results.push({
                        serverId: server.id,
                        serverName: server.name,
                        serverHost: server.host,
                        success: false,
                        error: 'Erro ao descriptografar senha'
                    });
                    session.completed++;
                    continue;
                }
                
                // Conectar ao servidor
                const { Sequelize } = require('sequelize');
                const sequelize = new Sequelize('postgres', server.username, decryptedPassword, {
                    host: server.host,
                    port: server.port,
                    dialect: 'postgres',
                    logging: false,
                    pool: {
                        max: 3,
                        min: 0,
                        acquire: 45000,
                        idle: 15000
                    },
                    retry: {
                        max: 2,
                        timeout: 20000
                    }
                });
                
                await sequelize.authenticate();
                
                // Buscar databases básicas
                const [databases] = await sequelize.query(`
                    SELECT 
                        d.datname as name,
                        u.usename as owner,
                        COALESCE(sd.description, '') as comment
                    FROM pg_database d
                    LEFT JOIN pg_user u ON d.datdba = u.usesysid
                    LEFT JOIN pg_shdescription sd ON sd.objoid = d.oid
                    WHERE d.datistemplate = false
                    ORDER BY d.datname
                `, {
                    timeout: 25000
                });
                
                // Buscar versões
                for (let j = 0; j < databases.length; j++) {
                    const db = databases[j];
                    try {
                        const dbSequelize = new Sequelize(db.name, server.username, decryptedPassword, {
                            host: server.host,
                            port: server.port,
                            dialect: 'postgres',
                            logging: false,
                            pool: { max: 1, min: 0, acquire: 5000, idle: 3000 },
                            retry: { max: 1, timeout: 3000 }
                        });
                        
                        const [versionResult] = await dbSequelize.query(`
                            SELECT versaover as version 
                            FROM public.versao 
                            WHERE dataver IS NOT NULL
                            AND sistemaver = 1
                            LIMIT 1
                        `, {
                            timeout: 5000
                        });
                        
                        await dbSequelize.close();
                        db.version = versionResult.length > 0 ? versionResult[0].version : 'N/A';
                        
                    } catch (versionError) {
                        db.version = 'N/A';
                    }
                    
                    // Inicializar tamanho
                    db.size = 'Carregando...';
                }
                
                await sequelize.close();
                
                // Salvar sucesso no cache
                await saveDatabaseCache(server.id, server.name, server.host, databases, 'success');
                
                // Adicionar resultado à sessão
                session.results.push({
                    serverId: server.id,
                    serverName: server.name,
                    serverHost: server.host,
                    success: true,
                    databases: databases
                });
                
            } catch (error) {
                logger.error(`Erro ao processar servidor ${server.name}:`, error);
                
                // Salvar erro no cache
                await saveDatabaseCache(server.id, server.name, server.host, null, 'error', error.message);
                
                session.results.push({
                    serverId: server.id,
                    serverName: server.name,
                    serverHost: server.host,
                    success: false,
                    error: error.message
                });
            }
            
            session.completed++;
        }
        
        session.status = 'completed';
        
    } catch (error) {
        logger.error('Erro no processamento progressivo:', error);
        session.status = 'error';
        session.error = error.message;
    }
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
            
            // Verificar se é um erro de constraint única
            if (error.name === 'SequelizeUniqueConstraintError') {
                const fields = error.errors.map(err => err.path).join(', ');
                return res.status(400).json({
                    success: false,
                    message: `Já existe um servidor com os mesmos dados: ${fields}`
                });
            }
            
            // Verificar se é um erro de validação
            if (error.name === 'SequelizeValidationError') {
                const messages = error.errors.map(err => err.message).join(', ');
                return res.status(400).json({
                    success: false,
                    message: `Erro de validação: ${messages}`
                });
            }
            
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
            
            // Verificar se é um erro de constraint única
            if (error.name === 'SequelizeUniqueConstraintError') {
                const fields = error.errors.map(err => err.path).join(', ');
                return res.status(400).json({
                    success: false,
                    message: `Já existe um servidor com os mesmos dados: ${fields}`
                });
            }
            
            // Verificar se é um erro de validação
            if (error.name === 'SequelizeValidationError') {
                const messages = error.errors.map(err => err.message).join(', ');
                return res.status(400).json({
                    success: false,
                    message: `Erro de validação: ${messages}`
                });
            }
            
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
                        
                        // Timeout progressivo: 90 segundos para servidores lentos
                        const timeout = setTimeout(() => {
                            logger.warn(`[${index + 1}/${servers.length}] Timeout ao conectar com ${server.name}`);
                            const errorResult = {
                                serverId: server.id,
                                serverName: server.name,
                                serverHost: server.host,
                                success: false,
                                error: 'Timeout: Conexão excedeu 90 segundos'
                            };
                            
                            // Salvar erro no cache
                            saveDatabaseCache(server.id, server.name, server.host, null, 'error', errorResult.error);
                            resolve(errorResult);
                        }, 90000);
                        
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
                                            max: 3,
                                            min: 0,
                                            acquire: 45000, // 45 segundos para aquisição (aumentado para servidores lentos)
                                            idle: 15000
                                        },
                                        retry: {
                                            max: 2, // Aumentar tentativas
                                            timeout: 20000 // 20 segundos para retry
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
                            try {
                                await sequelize.authenticate();
                                logger.info(`[${index + 1}/${servers.length}] Conexão estabelecida com ${server.name}`);
                            } catch (authError) {
                                logger.error(`[${index + 1}/${servers.length}] Erro na autenticação com ${server.name}:`, authError.message);
                                clearTimeout(timeout);
                                resolve({
                                    serverId: server.id,
                                    serverName: server.name,
                                    serverHost: server.host,
                                    success: false,
                                    error: `Erro de autenticação: ${authError.message}`
                                });
                                return;
                            }
                            
                            // Query para listar databases (PostgreSQL) com timeout aumentado
                            logger.info(`[${index + 1}/${servers.length}] Executando query para listar databases em ${server.name}`);
                            let databases;
                            try {
                                // Query básica para listar databases
                                [databases] = await sequelize.query(`
                                    SELECT 
                                        d.datname as name,
                                        u.usename as owner,
                                        COALESCE(sd.description, '') as comment
                                    FROM pg_database d
                                    LEFT JOIN pg_user u ON d.datdba = u.usesysid
                                    LEFT JOIN pg_shdescription sd ON sd.objoid = d.oid
                                    WHERE d.datistemplate = false
                                    ORDER BY d.datname
                                `, {
                                    timeout: 15000 // Timeout reduzido para query básica
                                });
                                
                                                            // Buscar versões junto com a listagem (síncrono)
                            logger.info(`[${index + 1}/${servers.length}] Buscando versões das ${databases.length} databases em ${server.name}`);
                            for (let i = 0; i < databases.length; i++) {
                                const db = databases[i];
                                try {
                                    // Conectar na database específica para buscar versão
                                    const dbSequelize = new Sequelize(db.name, server.username, decryptedPassword, {
                                        host: server.host,
                                        port: server.port,
                                        dialect: 'postgres',
                                        logging: false,
                                        pool: {
                                            max: 1,
                                            min: 0,
                                            acquire: 5000,
                                            idle: 3000
                                        },
                                        retry: {
                                            max: 1,
                                            timeout: 3000
                                        }
                                    });
                                    
                                    // Buscar versão da database
                                    const [versionResult] = await dbSequelize.query(`
                                        SELECT versaover as version 
                                        FROM public.versao 
                                        WHERE dataver IS NOT NULL
                                        AND sistemaver = 1
                                        LIMIT 1
                                    `, {
                                        timeout: 5000
                                    });
                                    
                                    await dbSequelize.close();
                                    
                                    // Adicionar versão ao resultado
                                    db.version = versionResult.length > 0 ? versionResult[0].version : 'N/A';
                                    
                                } catch (versionError) {
                                    logger.warn(`[${index + 1}/${servers.length}] Erro ao buscar versão da database ${db.name}: ${versionError.message}`);
                                    db.version = 'N/A';
                                }
                            }
                            
                            // Enviar dados do servidor imediatamente (progressivo)
                            const serverData = {
                                serverId: server.id,
                                serverName: server.name,
                                serverHost: server.host,
                                success: true,
                                databases: databases
                            };
                            
                            // Enviar via WebSocket ou SSE se disponível
                            if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
                                res.write(`data: ${JSON.stringify({
                                    type: 'server_data',
                                    data: serverData
                                })}\n\n`);
                            }
                                
                                // Garantir que todos os campos existam
                                databases.forEach(db => {
                                    db.size = 'Carregando...';
                                    db.version = db.version || 'N/A';
                                    db.owner = db.owner || 'N/A';
                                    db.comment = db.comment || '';
                                });
                                
                                // Buscar tamanhos em segundo plano (assíncrono)
                                setTimeout(async () => {
                                    logger.info(`[${index + 1}/${servers.length}] Buscando tamanhos das ${databases.length} databases em ${server.name} (background)`);
                                    
                                    // Criar nova conexão para buscar tamanhos
                                    const sizeSequelize = new Sequelize('postgres', server.username, decryptedPassword, {
                                        host: server.host,
                                        port: server.port,
                                        dialect: 'postgres',
                                        logging: false,
                                        pool: {
                                            max: 1,
                                            min: 0,
                                            acquire: 10000,
                                            idle: 5000
                                        },
                                        retry: {
                                            max: 1,
                                            timeout: 5000
                                        }
                                    });
                                    
                                    try {
                                        await sizeSequelize.authenticate();
                                        
                                        for (let i = 0; i < databases.length; i++) {
                                            try {
                                                const [sizeResult] = await sizeSequelize.query(`
                                                    SELECT pg_size_pretty(pg_database_size('${databases[i].name}')) as size
                                                `, {
                                                    timeout: 5000
                                                });
                                                databases[i].size = sizeResult[0]?.size || 'N/A';
                                            } catch (sizeError) {
                                                logger.warn(`[${index + 1}/${servers.length}] Erro ao buscar tamanho da database ${databases[i].name}: ${sizeError.message}`);
                                                databases[i].size = 'N/A';
                                            }
                                        }
                                        
                                        await sizeSequelize.close();
                                    } catch (error) {
                                        logger.error(`[${index + 1}/${servers.length}] Erro ao conectar para buscar tamanhos: ${error.message}`);
                                        await sizeSequelize.close();
                                    }
                                }, 100);
                            } catch (queryError) {
                                logger.error(`[${index + 1}/${servers.length}] Erro na query principal de ${server.name}:`, queryError.message);
                                clearTimeout(timeout);
                                resolve({
                                    serverId: server.id,
                                    serverName: server.name,
                                    serverHost: server.host,
                                    success: false,
                                    error: `Erro na query: ${queryError.message}`
                                });
                                return;
                            }
                            
                            // Versões já foram buscadas junto com a listagem
                            
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

    // Atualizar dados específicos de um servidor (tamanhos e versões)
    async updateServerData(req, res) {
        try {
            const { serverId } = req.params;
            
            if (!serverId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID do servidor é obrigatório'
                });
            }
            
            // Buscar servidor
            const server = await Server.findByPk(serverId);
            if (!server) {
                return res.status(404).json({
                    success: false,
                    message: 'Servidor não encontrado'
                });
            }
            
            logger.info(`Atualizando dados específicos do servidor: ${server.name} (${server.host})`);
            
            const decryptedPassword = decryptPassword(server.password);
            if (!decryptedPassword) {
                return res.status(500).json({
                    success: false,
                    message: 'Erro ao descriptografar senha'
                });
            }
            
            // Conectar ao servidor
            const { Sequelize } = require('sequelize');
            const sequelize = new Sequelize('postgres', server.username, decryptedPassword, {
                host: server.host,
                port: server.port,
                dialect: 'postgres',
                logging: false,
                pool: {
                    max: 1,
                    min: 0,
                    acquire: 15000,
                    idle: 5000
                },
                retry: {
                    max: 1,
                    timeout: 10000
                }
            });
            
            try {
                await sequelize.authenticate();
                
                // Buscar databases básicas
                const [databases] = await sequelize.query(`
                    SELECT 
                        d.datname as name,
                        u.usename as owner,
                        COALESCE(sd.description, '') as comment
                    FROM pg_database d
                    LEFT JOIN pg_user u ON d.datdba = u.usesysid
                    LEFT JOIN pg_shdescription sd ON sd.objoid = d.oid
                    WHERE d.datistemplate = false
                    ORDER BY d.datname
                `, {
                    timeout: 15000
                });
                
                // Buscar tamanhos e versões em paralelo
                const updatedDatabases = [];
                
                for (const db of databases) {
                    try {
                        // Buscar tamanho
                        const [sizeResult] = await sequelize.query(`
                            SELECT pg_size_pretty(pg_database_size('${db.name}')) as size
                        `, {
                            timeout: 5000
                        });
                        
                        // Buscar versão
                        let version = 'N/A';
                        try {
                            const dbSequelize = new Sequelize(db.name, server.username, decryptedPassword, {
                                host: server.host,
                                port: server.port,
                                dialect: 'postgres',
                                logging: false,
                                pool: { max: 1, min: 0, acquire: 5000, idle: 3000 },
                                retry: { max: 1, timeout: 3000 }
                            });
                            
                            const [versionResult] = await dbSequelize.query(`
                                SELECT versaover as version 
                                FROM public.versao 
                                WHERE dataver IS NOT NULL
                                AND sistemaver = 1
                                LIMIT 1
                            `, {
                                timeout: 5000
                            });
                            
                            await dbSequelize.close();
                            version = versionResult.length > 0 ? versionResult[0].version : 'N/A';
                        } catch (versionError) {
                            logger.warn(`Erro ao buscar versão da database ${db.name}: ${versionError.message}`);
                        }
                        
                        updatedDatabases.push({
                            name: db.name,
                            size: sizeResult[0]?.size || 'N/A',
                            owner: db.owner,
                            comment: db.comment,
                            version: version
                        });
                        
                    } catch (error) {
                        logger.warn(`Erro ao processar database ${db.name}: ${error.message}`);
                        updatedDatabases.push({
                            name: db.name,
                            size: 'N/A',
                            owner: db.owner,
                            comment: db.comment,
                            version: 'N/A'
                        });
                    }
                }
                
                await sequelize.close();
                
                res.json({
                    success: true,
                    data: {
                        serverId: server.id,
                        serverName: server.name,
                        serverHost: server.host,
                        databases: updatedDatabases
                    }
                });
                
            } catch (error) {
                await sequelize.close();
                throw error;
            }
            
        } catch (error) {
            logger.error('Erro ao atualizar dados do servidor:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: error.message
            });
        }
    }

    // Atualizar apenas tamanhos das databases de um servidor
    async updateDatabaseSizes(req, res) {
        try {
            const { serverId } = req.params;
            
            if (!serverId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID do servidor é obrigatório'
                });
            }
            
            // Buscar servidor
            const server = await Server.findByPk(serverId);
            if (!server) {
                return res.status(404).json({
                    success: false,
                    message: 'Servidor não encontrado'
                });
            }
            
            logger.info(`Atualizando tamanhos das databases do servidor: ${server.name} (${server.host})`);
            
            const decryptedPassword = decryptPassword(server.password);
            if (!decryptedPassword) {
                return res.status(500).json({
                    success: false,
                    message: 'Erro ao descriptografar senha'
                });
            }
            
            // Conectar ao servidor
            const { Sequelize } = require('sequelize');
            const sequelize = new Sequelize('postgres', server.username, decryptedPassword, {
                host: server.host,
                port: server.port,
                dialect: 'postgres',
                logging: false,
                pool: {
                    max: 1,
                    min: 0,
                    acquire: 15000,
                    idle: 5000
                },
                retry: {
                    max: 1,
                    timeout: 10000
                }
            });
            
            try {
                await sequelize.authenticate();
                
                // Buscar databases básicas
                const [databases] = await sequelize.query(`
                    SELECT 
                        d.datname as name
                    FROM pg_database d
                    WHERE d.datistemplate = false
                    ORDER BY d.datname
                `, {
                    timeout: 15000
                });
                
                // Buscar tamanhos
                const sizes = [];
                for (const db of databases) {
                    try {
                        const [sizeResult] = await sequelize.query(`
                            SELECT pg_size_pretty(pg_database_size('${db.name}')) as size
                        `, {
                            timeout: 5000
                        });
                        
                        sizes.push({
                            name: db.name,
                            size: sizeResult[0]?.size || 'N/A'
                        });
                        
                    } catch (error) {
                        logger.warn(`Erro ao buscar tamanho da database ${db.name}: ${error.message}`);
                        sizes.push({
                            name: db.name,
                            size: 'N/A'
                        });
                    }
                }
                
                await sequelize.close();
                
                res.json({
                    success: true,
                    data: {
                        serverId: server.id,
                        serverName: server.name,
                        sizes: sizes
                    }
                });
                
            } catch (error) {
                await sequelize.close();
                throw error;
            }
            
        } catch (error) {
            logger.error('Erro ao atualizar tamanhos das databases:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: error.message
            });
        }
    }

    // Listagem progressiva de databases com SSE
    async listDatabasesProgress(req, res) {
        try {
            // Verificar autenticação
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    success: false,
                    message: 'Token de autenticação necessário'
                });
            }
            
            const { serverIds } = req.body;
            
            if (!serverIds || !Array.isArray(serverIds) || serverIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'IDs dos servidores são obrigatórios'
                });
            }
            
            // Configurar headers para SSE
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });
            
            logger.info(`Iniciando listagem progressiva de databases para ${serverIds.length} servidores`);
            
            // Buscar servidores
            const servers = await Server.findAll({
                where: { 
                    id: serverIds,
                    isActive: true 
                }
            });
            
            if (servers.length === 0) {
                res.write(`data: ${JSON.stringify({
                    type: 'error',
                    message: 'Nenhum servidor ativo encontrado'
                })}\n\n`);
                res.end();
                return;
            }
            
            // Enviar início do processo
            res.write(`data: ${JSON.stringify({
                type: 'start',
                totalServers: servers.length,
                message: 'Iniciando carregamento...'
            })}\n\n`);
            
            // Processar servidores sequencialmente
            for (let i = 0; i < servers.length; i++) {
                const server = servers[i];
                
                // Enviar progresso
                res.write(`data: ${JSON.stringify({
                    type: 'progress',
                    current: i + 1,
                    total: servers.length,
                    serverName: server.name,
                    message: `Conectando com ${server.name}...`
                })}\n\n`);
                
                try {
                    const decryptedPassword = decryptPassword(server.password);
                    if (!decryptedPassword) {
                        res.write(`data: ${JSON.stringify({
                            type: 'server_error',
                            serverId: server.id,
                            serverName: server.name,
                            error: 'Erro ao descriptografar senha'
                        })}\n\n`);
                        continue;
                    }
                    
                    // Conectar ao servidor
                    const { Sequelize } = require('sequelize');
                    const sequelize = new Sequelize('postgres', server.username, decryptedPassword, {
                        host: server.host,
                        port: server.port,
                        dialect: 'postgres',
                        logging: false,
                        pool: {
                            max: 3,
                            min: 0,
                            acquire: 45000,
                            idle: 15000
                        },
                        retry: {
                            max: 2,
                            timeout: 20000
                        }
                    });
                    
                    await sequelize.authenticate();
                    
                    // Buscar databases básicas
                    const [databases] = await sequelize.query(`
                        SELECT 
                            d.datname as name,
                            u.usename as owner,
                            COALESCE(sd.description, '') as comment
                        FROM pg_database d
                        LEFT JOIN pg_user u ON d.datdba = u.usesysid
                        LEFT JOIN pg_shdescription sd ON sd.objoid = d.oid
                        WHERE d.datistemplate = false
                        ORDER BY d.datname
                    `, {
                        timeout: 25000
                    });
                    
                    // Buscar versões
                    for (let j = 0; j < databases.length; j++) {
                        const db = databases[j];
                        try {
                            const dbSequelize = new Sequelize(db.name, server.username, decryptedPassword, {
                                host: server.host,
                                port: server.port,
                                dialect: 'postgres',
                                logging: false,
                                pool: { max: 1, min: 0, acquire: 5000, idle: 3000 },
                                retry: { max: 1, timeout: 3000 }
                            });
                            
                            const [versionResult] = await dbSequelize.query(`
                                SELECT versaover as version 
                                FROM public.versao 
                                WHERE dataver IS NOT NULL
                                AND sistemaver = 1
                                LIMIT 1
                            `, {
                                timeout: 5000
                            });
                            
                            await dbSequelize.close();
                            db.version = versionResult.length > 0 ? versionResult[0].version : 'N/A';
                            
                        } catch (versionError) {
                            db.version = 'N/A';
                        }
                        
                        // Inicializar tamanho
                        db.size = 'Carregando...';
                    }
                    
                    await sequelize.close();
                    
                    // Enviar dados do servidor
                    res.write(`data: ${JSON.stringify({
                        type: 'server_data',
                        serverId: server.id,
                        serverName: server.name,
                        serverHost: server.host,
                        success: true,
                        databases: databases
                    })}\n\n`);
                    
                } catch (error) {
                    logger.error(`Erro ao processar servidor ${server.name}:`, error);
                    res.write(`data: ${JSON.stringify({
                        type: 'server_error',
                        serverId: server.id,
                        serverName: server.name,
                        error: error.message
                    })}\n\n`);
                }
            }
            
            // Enviar finalização
            res.write(`data: ${JSON.stringify({
                type: 'complete',
                message: 'Carregamento concluído'
            })}\n\n`);
            
            res.end();
            
        } catch (error) {
            logger.error('Erro na listagem progressiva:', error);
            res.write(`data: ${JSON.stringify({
                type: 'error',
                message: 'Erro interno do servidor',
                error: error.message
            })}\n\n`);
            res.end();
        }
    }

    // Carregamento progressivo real de databases
    async listDatabasesProgressive(req, res) {
        try {
            const { serverIds } = req.body;
            
            if (!serverIds || !Array.isArray(serverIds) || serverIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'IDs dos servidores são obrigatórios'
                });
            }
            
            logger.info(`Iniciando carregamento progressivo real para ${serverIds.length} servidores`);
            
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
                    message: 'Nenhum servidor ativo encontrado'
                });
            }
            
            // Iniciar processamento em background
            const sessionId = Date.now().toString();
            global.progressiveSessions = global.progressiveSessions || {};
            global.progressiveSessions[sessionId] = {
                servers: servers,
                results: [],
                completed: 0,
                total: servers.length,
                status: 'processing'
            };
            
            // Processar servidores em background
            processServersProgressive(sessionId);
            
            res.json({
                success: true,
                sessionId: sessionId,
                totalServers: servers.length,
                message: 'Carregamento progressivo iniciado'
            });
            
        } catch (error) {
            logger.error('Erro ao iniciar carregamento progressivo:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: error.message
            });
        }
    }
    
    // Verificar progresso do carregamento
    async checkProgressiveProgress(req, res) {
        try {
            const { sessionId } = req.params;
            
            if (!global.progressiveSessions || !global.progressiveSessions[sessionId]) {
                return res.status(404).json({
                    success: false,
                    message: 'Sessão não encontrada'
                });
            }
            
            const session = global.progressiveSessions[sessionId];
            
            res.json({
                success: true,
                data: {
                    status: session.status,
                    completed: session.completed,
                    total: session.total,
                    results: session.results,
                    progress: (session.completed / session.total) * 100
                }
            });
            
            // Limpar sessão se concluída
            if (session.status === 'completed') {
                setTimeout(() => {
                    delete global.progressiveSessions[sessionId];
                }, 60000); // Limpar após 1 minuto
            }
            
        } catch (error) {
            logger.error('Erro ao verificar progresso:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: error.message
            });
        }
    }
}

module.exports = new ServerController(); 