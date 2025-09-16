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

    // Buscar objetos do banco de dados
    async searchObjects(req, res) {
        try {
            const { searchTerm, searchType = 'contains', objectType, searchLimit = 25, serverIds } = req.body;
            
            if (!searchTerm || !serverIds || !Array.isArray(serverIds) || serverIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Termo de busca e IDs dos servidores são obrigatórios'
                });
            }
            
            // Validação de termo de busca (mínimo 3 caracteres)
            if (searchTerm.length < 3) {
                return res.status(400).json({
                    success: false,
                    message: 'Termo de busca deve ter pelo menos 3 caracteres'
                });
            }
            
            logger.info(`Iniciando busca de objetos: "${searchTerm}" em ${serverIds.length} servidores`);
            
            // Buscar servidores
            const servers = await Server.findAll({
                where: { 
                    id: serverIds,
                    isActive: true 
                }
            });
            
            logger.info(`Servidores encontrados: ${servers.length}`, servers.map(s => ({ id: s.id, name: s.name, host: s.host })));
            
            if (servers.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Nenhum servidor ativo encontrado'
                });
            }
            
                // Configurações de performance
                const MAX_OBJECTS_PER_SERVER = Math.min(searchLimit, 250); // Limite de objetos por servidor
                const SEARCH_TIMEOUT = 30000; // 30 segundos timeout por servidor
                const MAX_TOTAL_OBJECTS = searchLimit; // Limite total de objetos
            
            // Processar servidores em paralelo com timeout
            const results = await Promise.allSettled(
                servers.map(async (server) => {
                    return new Promise(async (resolve) => {
                        // Timeout por servidor
                        const timeout = setTimeout(() => {
                            resolve({
                                serverId: server.id,
                                serverName: server.name,
                                serverHost: server.host,
                                success: false,
                                error: 'Timeout: Busca excedeu 30 segundos'
                            });
                        }, SEARCH_TIMEOUT);
                        
                        try {
                            const decryptedPassword = decryptPassword(server.password);
                            if (!decryptedPassword) {
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
                            
                            // Conectar ao servidor com configurações otimizadas
                            const { Sequelize } = require('sequelize');
                            const sequelize = new Sequelize('postgres', server.username, decryptedPassword, {
                                host: server.host,
                                port: server.port,
                                dialect: 'postgres',
                                logging: false,
                                pool: {
                                    max: 2,
                                    min: 0,
                                    acquire: 20000,
                                    idle: 5000
                                },
                                retry: {
                                    max: 1,
                                    timeout: 10000
                                }
                            });
                            
                            await sequelize.authenticate();
                            logger.info(`Conectado ao servidor ${server.name}, iniciando busca de objetos...`);
                            
                                // Buscar objetos com limite
                                const objects = await searchObjectsInServer(sequelize, searchTerm, searchType, objectType, server, MAX_OBJECTS_PER_SERVER);
                            
                            logger.info(`Servidor ${server.name}: encontrados ${objects.length} objetos`);
                            
                            await sequelize.close();
                            clearTimeout(timeout);
                            
                            resolve({
                                serverId: server.id,
                                serverName: server.name,
                                serverHost: server.host,
                                success: true,
                                objects: objects
                            });
                            
                        } catch (error) {
                            clearTimeout(timeout);
                            logger.error(`Erro ao buscar objetos no servidor ${server.name}:`, error);
                            resolve({
                                serverId: server.id,
                                serverName: server.name,
                                serverHost: server.host,
                                success: false,
                                error: error.message
                            });
                        }
                    });
                })
            );
            
            // Processar resultados
            const allObjects = [];
            const processedResults = results.map(result => {
                if (result.status === 'fulfilled') {
                    const serverResult = result.value;
                    if (serverResult.success && serverResult.objects) {
                        serverResult.objects.forEach(obj => {
                            allObjects.push({
                                ...obj,
                                server_id: serverResult.serverId,
                                server_name: serverResult.serverName,
                                server_host: serverResult.serverHost,
                                connection_status: 'connected'
                            });
                        });
                    }
                    return serverResult;
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
            
            // Limitar total de objetos retornados
            const limitedObjects = allObjects.slice(0, MAX_TOTAL_OBJECTS);
            const hasMore = allObjects.length > MAX_TOTAL_OBJECTS;
            
            logger.info(`Busca concluída: ${limitedObjects.length} objetos encontrados${hasMore ? ` (limitado de ${allObjects.length})` : ''}`);
            
            res.json({
                success: true,
                data: limitedObjects,
                summary: {
                    totalObjects: limitedObjects.length,
                    totalFound: allObjects.length,
                    hasMore: hasMore,
                    totalServers: processedResults.length,
                    successfulServers: processedResults.filter(r => r.success).length
                }
            });
            
        } catch (error) {
            logger.error('Erro ao buscar objetos:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: error.message
            });
        }
    }
}

// Função auxiliar para buscar objetos em um servidor específico
async function searchObjectsInServer(sequelize, searchTerm, searchType, objectType, server, maxObjects) {
    const objects = [];
    
    // Construir padrão de busca baseado no tipo
    let searchPattern;
    switch (searchType) {
        case 'starts_with':
            searchPattern = `${searchTerm}%`;
            break;
        case 'ends_with':
            searchPattern = `%${searchTerm}`;
            break;
        case 'exact':
            searchPattern = searchTerm;
            break;
        case 'contains':
        default:
            searchPattern = `%${searchTerm}%`;
            break;
    }
    
    try {
        // Buscar databases do servidor (limitado para performance)
        const [databases] = await sequelize.query(`
            SELECT datname as name
            FROM pg_database 
            WHERE datistemplate = false
            ORDER BY datname
            LIMIT 10
        `, {
            timeout: 5000
        });
        
        logger.info(`Servidor ${server.name}: encontradas ${databases.length} databases`);
        
        // Buscar objetos em cada database (máximo 5 databases para performance)
        for (const db of databases.slice(0, 5)) {
            try {
                // Conectar na database específica
                const dbSequelize = new Sequelize(db.name, server.username, decryptPassword(server.password), {
                    host: server.host,
                    port: server.port,
                    dialect: 'postgres',
                    logging: false,
                    pool: { max: 1, min: 0, acquire: 5000, idle: 3000 },
                    retry: { max: 1, timeout: 5000 }
                });
                
                await dbSequelize.authenticate();
                logger.info(`Conectado na database ${db.name}, buscando objetos do tipo: ${objectType || 'todos'}`);
                
                        // Buscar objetos baseado no tipo com limite
                        const dbObjects = await searchObjectsByType(dbSequelize, searchPattern, searchType, objectType, db.name, Math.floor(maxObjects / databases.length));
                logger.info(`Database ${db.name}: encontrados ${dbObjects.length} objetos`);
                objects.push(...dbObjects);
                
                // Parar se atingiu o limite
                if (objects.length >= maxObjects) {
                    await dbSequelize.close();
                    break;
                }
                
                await dbSequelize.close();
                
            } catch (dbError) {
                logger.warn(`Erro ao buscar objetos na database ${db.name}: ${dbError.message}`);
                continue;
            }
        }
        
    } catch (error) {
        logger.error(`Erro ao buscar objetos no servidor ${server.name}:`, error);
        throw error;
    }
    
    return objects.slice(0, maxObjects);
}

// Função para buscar objetos por tipo
async function searchObjectsByType(sequelize, searchPattern, searchType, objectType, databaseName, maxObjects = 50) {
    const objects = [];
    
    try {
        if (!objectType || objectType === 'table') {
            logger.info(`Buscando tabelas com padrão: ${searchPattern}`);
            
            // Escolher operador baseado no tipo de busca
            const operator = searchType === 'exact' ? '=' : 'ILIKE';
            
            // Buscar tabelas (versão simplificada e mais robusta)
            const [tables] = await sequelize.query(`
                SELECT 
                    n.nspname as schema_name,
                    c.relname as object_name,
                    'table' as object_type,
                    pg_size_pretty(pg_total_relation_size(c.oid)) as size,
                    obj_description(c.oid) as description,
                    pg_get_userbyid(c.relowner) as owner
                FROM pg_class c
                JOIN pg_namespace n ON c.relnamespace = n.oid
                WHERE c.relkind = 'r'
                AND n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                AND c.relname ${operator} $1
                ORDER BY n.nspname, c.relname
                LIMIT $2
            `, {
                bind: [searchPattern, maxObjects],
                timeout: 8000
            });
            
            // Obter DDL real para cada tabela usando funções nativas do PostgreSQL
            for (const table of tables) {
                try {
                    // Buscar colunas da tabela para construir o DDL
                    const [columns] = await sequelize.query(`
                        SELECT 
                            a.attname as column_name,
                            pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
                            NOT a.attnotnull as is_nullable,
                            pg_get_expr(d.adbin, d.adrelid) as column_default,
                            a.attnum as ordinal_position
                        FROM pg_attribute a
                        JOIN pg_class c ON a.attrelid = c.oid
                        JOIN pg_namespace n ON c.relnamespace = n.oid
                        LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
                        WHERE c.relname = '${table.object_name}'
                        AND n.nspname = '${table.schema_name}'
                        AND a.attnum > 0
                        AND NOT a.attisdropped
                        ORDER BY a.attnum
                    `, {
                        timeout: 5000
                    });
                    
                    // Construir DDL manualmente
                    let ddl = `CREATE TABLE ${table.schema_name}.${table.object_name} (\n`;
                    const columnDefs = columns.map(col => {
                        let def = `    ${col.column_name} ${col.data_type}`;
                        if (!col.is_nullable) def += ' NOT NULL';
                        if (col.column_default) def += ` DEFAULT ${col.column_default}`;
                        return def;
                    });
                    ddl += columnDefs.join(',\n');
                    ddl += `\n);`;
                    
                    objects.push({
                        ...table,
                        database_name: databaseName,
                        sql_definition: ddl
                    });
                } catch (ddlError) {
                    logger.warn(`Erro ao obter DDL da tabela ${table.schema_name}.${table.object_name}: ${ddlError.message}`);
                    objects.push({
                        ...table,
                        database_name: databaseName,
                        sql_definition: `-- Tabela: ${table.schema_name}.${table.object_name}\n-- Tamanho: ${table.size}\n-- Dono: ${table.owner}\n-- Erro ao obter DDL: ${ddlError.message}`
                    });
                }
            }
        }
        
        if (!objectType || objectType === 'column') {
            // Escolher operador baseado no tipo de busca
            const operator = searchType === 'exact' ? '=' : 'ILIKE';
            
            // Buscar colunas (versão simplificada)
            const [columns] = await sequelize.query(`
                SELECT 
                    n.nspname as schema_name,
                    c.relname as table_name,
                    a.attname as object_name,
                    'column' as object_type,
                    pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
                    NOT a.attnotnull as is_nullable,
                    pg_get_expr(d.adbin, d.adrelid) as column_default,
                    a.attnum as ordinal_position,
                    col_description(a.attrelid, a.attnum) as description,
                    pg_get_userbyid(c.relowner) as owner
                FROM pg_attribute a
                JOIN pg_class c ON a.attrelid = c.oid
                JOIN pg_namespace n ON c.relnamespace = n.oid
                LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
                WHERE c.relkind = 'r'
                AND n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                AND a.attnum > 0
                AND NOT a.attisdropped
                AND a.attname ${operator} $1
                ORDER BY n.nspname, c.relname, a.attnum
                LIMIT $2
            `, {
                bind: [searchPattern, maxObjects],
                timeout: 8000
            });
            
            objects.push(...columns.map(column => ({
                ...column,
                database_name: databaseName,
                sql_definition: `-- Coluna: ${column.schema_name}.${column.table_name}.${column.object_name}\n-- Tipo: ${column.data_type}\n-- Nullable: ${column.is_nullable}\n-- Posição: ${column.ordinal_position}\n-- Default: ${column.column_default || 'NULL'}\n-- Descrição: ${column.description || 'N/A'}\n-- Dono: ${column.owner}`
            })));
        }
        
        if (!objectType || objectType === 'index') {
            // Buscar índices (otimizada)
            const [indexes] = await sequelize.query(`
                SELECT 
                    schemaname as schema_name,
                    indexname as object_name,
                    'index' as object_type,
                    tablename as table_name,
                    pg_size_pretty(pg_relation_size(indexrelid)) as size,
                    obj_description(indexrelid) as description,
                    pg_get_userbyid(c.relowner) as owner
                FROM pg_indexes i
                LEFT JOIN pg_class c ON c.relname = i.indexname
                WHERE indexname ILIKE $1
                ORDER BY schemaname, indexname
                LIMIT $2
            `, {
                bind: [searchPattern, maxObjects],
                timeout: 8000
            });
            
            // Obter DDL real para cada índice
            for (const index of indexes) {
                try {
                    const [ddlResult] = await sequelize.query(`
                        SELECT pg_get_indexdef(i.indexrelid) as ddl
                        FROM pg_indexes i
                        JOIN pg_class c ON c.relname = i.indexname
                        WHERE i.schemaname = '${index.schema_name}' AND i.indexname = '${index.object_name}'
                    `, {
                        timeout: 5000
                    });
                    
                    const ddl = ddlResult[0]?.ddl || `-- Índice: ${index.schema_name}.${index.object_name}\n-- Tabela: ${index.table_name}\n-- Tamanho: ${index.size}`;
                    
                    objects.push({
                        ...index,
                        database_name: databaseName,
                        sql_definition: ddl
                    });
                } catch (ddlError) {
                    logger.warn(`Erro ao obter DDL do índice ${index.schema_name}.${index.object_name}: ${ddlError.message}`);
                    objects.push({
                        ...index,
                        database_name: databaseName,
                        sql_definition: `-- Índice: ${index.schema_name}.${index.object_name}\n-- Tabela: ${index.table_name}\n-- Tamanho: ${index.size}\n-- Erro ao obter DDL: ${ddlError.message}`
                    });
                }
            }
        }
        
        if (!objectType || objectType === 'view') {
            // Buscar views (otimizada)
            const [views] = await sequelize.query(`
                SELECT 
                    schemaname as schema_name,
                    viewname as object_name,
                    'view' as object_type,
                    pg_size_pretty(pg_relation_size(schemaname||'.'||viewname)) as size,
                    obj_description(c.oid) as description,
                    pg_get_userbyid(c.relowner) as owner
                FROM pg_views v
                LEFT JOIN pg_class c ON c.relname = v.viewname AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = v.schemaname)
                WHERE viewname ILIKE $1
                ORDER BY schemaname, viewname
                LIMIT $2
            `, {
                bind: [searchPattern, maxObjects],
                timeout: 8000
            });
            
            // Obter DDL real para cada view usando funções nativas
            for (const view of views) {
                try {
                    const [ddlResult] = await sequelize.query(`
                        SELECT pg_get_viewdef(c.oid, true) as ddl
                        FROM pg_class c
                        JOIN pg_namespace n ON c.relnamespace = n.oid
                        WHERE c.relname = '${view.object_name}'
                        AND n.nspname = '${view.schema_name}'
                        AND c.relkind = 'v'
                    `, {
                        timeout: 5000
                    });
                    
                    const ddl = ddlResult[0]?.ddl || `-- View: ${view.schema_name}.${view.object_name}\n-- Tamanho: ${view.size}\n-- Dono: ${view.owner}`;
                    
                    objects.push({
                        ...view,
                        database_name: databaseName,
                        sql_definition: `CREATE VIEW ${view.schema_name}.${view.object_name} AS\n${ddl};\n\n-- Tamanho: ${view.size}\n-- Dono: ${view.owner}`
                    });
                } catch (ddlError) {
                    logger.warn(`Erro ao obter DDL da view ${view.schema_name}.${view.object_name}: ${ddlError.message}`);
                    objects.push({
                        ...view,
                        database_name: databaseName,
                        sql_definition: `-- View: ${view.schema_name}.${view.object_name}\n-- Tamanho: ${view.size}\n-- Dono: ${view.owner}\n-- Erro ao obter DDL: ${ddlError.message}`
                    });
                }
            }
        }
        
        if (!objectType || objectType === 'function' || objectType === 'procedure') {
            // Buscar funções e procedures (otimizada)
            const [functions] = await sequelize.query(`
                SELECT 
                    n.nspname as schema_name,
                    p.proname as object_name,
                    CASE 
                        WHEN p.prokind = 'f' THEN 'function'
                        WHEN p.prokind = 'p' THEN 'procedure'
                        ELSE 'function'
                    END as object_type,
                    pg_get_function_result(p.oid) as return_type,
                    pg_get_function_arguments(p.oid) as arguments,
                    obj_description(p.oid) as description,
                    pg_get_userbyid(p.proowner) as owner
                FROM pg_proc p
                LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE p.proname ILIKE $1
                ORDER BY n.nspname, p.proname
                LIMIT $2
            `, {
                bind: [searchPattern, maxObjects],
                timeout: 8000
            });
            
            objects.push(...functions.map(func => ({
                ...func,
                database_name: databaseName,
                sql_definition: `-- ${func.object_type}: ${func.schema_name}.${func.object_name}\n-- Retorno: ${func.return_type}\n-- Argumentos: ${func.arguments}`
            })));
        }
        
        if (!objectType || objectType === 'trigger') {
            // Buscar triggers (otimizada)
            const [triggers] = await sequelize.query(`
                SELECT 
                    t.trigger_schema as schema_name,
                    t.trigger_name as object_name,
                    'trigger' as object_type,
                    t.event_object_table as table_name,
                    t.action_timing,
                    t.event_manipulation,
                    obj_description(pgc.oid) as description,
                    pg_get_userbyid(pgc.relowner) as owner
                FROM information_schema.triggers t
                LEFT JOIN pg_class pgc ON pgc.relname = t.event_object_table AND pgc.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = t.trigger_schema)
                WHERE t.trigger_name ILIKE $1
                ORDER BY t.trigger_schema, t.trigger_name
                LIMIT $2
            `, {
                bind: [searchPattern, maxObjects],
                timeout: 8000
            });
            
            objects.push(...triggers.map(trigger => ({
                ...trigger,
                database_name: databaseName,
                sql_definition: `-- Trigger: ${trigger.schema_name}.${trigger.object_name}\n-- Tabela: ${trigger.table_name}\n-- Evento: ${trigger.event_manipulation} ${trigger.action_timing}`
            })));
        }
        
        if (!objectType || objectType === 'sequence') {
            // Buscar sequências (otimizada)
            const [sequences] = await sequelize.query(`
                SELECT 
                    schemaname as schema_name,
                    sequencename as object_name,
                    'sequence' as object_type,
                    pg_size_pretty(pg_relation_size(schemaname||'.'||sequencename)) as size,
                    obj_description(c.oid) as description,
                    pg_get_userbyid(c.relowner) as owner
                FROM pg_sequences s
                LEFT JOIN pg_class c ON c.relname = s.sequencename AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = s.schemaname)
                WHERE sequencename ILIKE $1
                ORDER BY schemaname, sequencename
                LIMIT $2
            `, {
                bind: [searchPattern, maxObjects],
                timeout: 8000
            });
            
            objects.push(...sequences.map(seq => ({
                ...seq,
                database_name: databaseName,
                sql_definition: `-- Sequência: ${seq.schema_name}.${seq.object_name}\n-- Tamanho: ${seq.size}\n-- Dono: ${seq.owner}`
            })));
        }
        
        if (!objectType || objectType === 'constraint') {
            // Buscar constraints (otimizada)
            const [constraints] = await sequelize.query(`
                SELECT 
                    tc.table_schema as schema_name,
                    tc.constraint_name as object_name,
                    'constraint' as object_type,
                    tc.table_name,
                    tc.constraint_type,
                    obj_description(pgc.oid) as description,
                    pg_get_userbyid(pgc.relowner) as owner
                FROM information_schema.table_constraints tc
                LEFT JOIN pg_class pgc ON pgc.relname = tc.table_name AND pgc.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = tc.table_schema)
                WHERE tc.constraint_name ILIKE $1
                ORDER BY tc.table_schema, tc.constraint_name
                LIMIT $2
            `, {
                bind: [searchPattern, maxObjects],
                timeout: 8000
            });
            
            objects.push(...constraints.map(constraint => ({
                ...constraint,
                database_name: databaseName,
                sql_definition: `-- Constraint: ${constraint.schema_name}.${constraint.object_name}\n-- Tabela: ${constraint.table_name}\n-- Tipo: ${constraint.constraint_type}`
            })));
        }
        
    } catch (error) {
        logger.error(`Erro ao buscar objetos por tipo na database ${databaseName}:`, error);
        throw error;
    }
    
    return objects;
}

module.exports = new ServerController(); 