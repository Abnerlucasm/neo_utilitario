const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { User, Role } = require('../models/postgresql/associations');

// Middleware para verificar se o usuário está autenticado
const requireAuth = async (req, res, next) => {
    try {
        // Verificar se há token no header Authorization
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('Acesso negado: Token não fornecido');
            return res.status(401).json({ error: 'Acesso negado. Autenticação necessária.' });
        }

        const token = authHeader.split(' ')[1];
        
        // Verificar token
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta');
            
            // Buscar usuário no banco de dados
            const user = await User.findByPk(decoded.id, {
                include: [{
                    model: Role,
                    as: 'userRoles'
                }]
            });
            
            if (!user) {
                logger.warn(`Usuário não encontrado: ${decoded.id}`);
                return res.status(401).json({ error: 'Usuário não encontrado.' });
            }
            
            if (!user.is_active) {
                logger.warn(`Tentativa de acesso com usuário inativo: ${user.email}`);
                return res.status(403).json({ error: 'Conta desativada. Entre em contato com o administrador.' });
            }
            
            // Adicionar usuário ao objeto de requisição
            req.user = user;
            
            // Atualizar último acesso
            user.last_login = new Date();
            await user.save();
            
            next();
        } catch (error) {
            logger.error('Erro ao verificar token:', error);
            return res.status(401).json({ error: 'Token inválido ou expirado.' });
        }
    } catch (error) {
        logger.error('Erro no middleware de autenticação:', error);
        return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};

// Middleware para verificar se o usuário é admin
const requireAdmin = async (req, res, next) => {
    try {
        // Primeiro verificar se o usuário está autenticado
        await requireAuth(req, res, async () => {
            try {
                // Buscar o usuário completo no banco de dados para ter acesso ao método hasRole
                const User = require('../models/postgresql/User');
                const user = await User.findByPk(req.user.id);
                
                if (!user) {
                    logger.warn(`Usuário não encontrado: ${req.user.id}`);
                    return res.status(404).json({ error: 'Usuário não encontrado.' });
                }
                
                // Verificar se o usuário tem o papel de admin usando o método hasRole
                const isAdmin = await user.hasRole('admin');
                
                if (!isAdmin) {
                    logger.warn(`Acesso de administrador negado para: ${req.user.email}`);
                    return res.status(403).json({ error: 'Acesso negado. Permissão de administrador necessária.' });
                }
                
                next();
            } catch (error) {
                logger.error('Erro ao verificar permissão de administrador:', error);
                return res.status(500).json({ error: 'Erro interno do servidor.' });
            }
        });
    } catch (error) {
        logger.error('Erro no middleware de verificação de admin:', error);
        return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};

// Middleware para verificar se o usuário tem acesso a um recurso específico
const requireResource = (resourcePath) => {
    return async (req, res, next) => {
        try {
            // Primeiro verificar se o usuário está autenticado
            await requireAuth(req, res, async () => {
                try {
                    // Buscar o usuário completo no banco de dados para ter acesso ao método hasRole
                    const User = require('../models/postgresql/User');
                    const user = await User.findByPk(req.user.id);
                    
                    if (!user) {
                        logger.warn(`Usuário não encontrado: ${req.user.id}`);
                        return res.status(404).json({ error: 'Usuário não encontrado.' });
                    }
                    
                    // Se o usuário for admin, permitir acesso a qualquer recurso
                    const isAdmin = await user.hasRole('admin');
                    
                    if (isAdmin) {
                        return next();
                    }
                    
                    // Verificar se o usuário tem acesso ao recurso específico
                    // Implementar lógica de verificação de recursos aqui
                    
                    // Por enquanto, permitir acesso
                    next();
                } catch (error) {
                    logger.error('Erro ao verificar acesso a recurso:', error);
                    return res.status(500).json({ error: 'Erro interno do servidor.' });
                }
            });
        } catch (error) {
            logger.error('Erro no middleware de verificação de recurso:', error);
            return res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    };
};

// Middleware de CORS
const corsMiddleware = (req, res, next) => {
    // Configurações básicas de CORS
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
};

// Middleware para verificar se o usuário tem uma role específica
const checkRole = (roleName) => {
    return async (req, res, next) => {
        try {
            // Verificar se o usuário existe e está autenticado
            if (!req.user) {
                return res.status(401).json({ message: 'Usuário não autenticado' });
            }

            // Buscar o usuário completo no banco de dados
            const User = require('../models/postgresql/User');
            const user = await User.findByPk(req.user.id);

            if (!user) {
                return res.status(404).json({ message: 'Usuário não encontrado' });
            }

            // Verificar se o usuário tem a role necessária
            const hasRequiredRole = await user.hasRole(roleName.toLowerCase());

            if (!hasRequiredRole) {
                return res.status(403).json({ 
                    message: 'Acesso negado. Você não tem permissão para acessar este recurso.',
                    requiredRole: roleName
                });
            }

            next();
        } catch (error) {
            console.error('Erro ao verificar role do usuário:', error);
            return res.status(500).json({ message: 'Erro interno do servidor' });
        }
    };
};

module.exports = {
    requireAuth,
    requireAdmin,
    requireResource,
    corsMiddleware,
    checkRole
}; 