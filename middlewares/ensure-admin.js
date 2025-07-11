const { User, Role } = require('../models/postgresql/associations');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { sequelize } = require('../config/database');
const { getDefaultAdminConfig } = require('../utils/admin-config');

// Middleware para verificar se o usuário é admin
const requireAdmin = async (req, res, next) => {
    try {
        // Verificar se é uma requisição de upload de arquivo (multipart/form-data)
        const isMultipartRequest = req.headers['content-type'] && 
                                  req.headers['content-type'].startsWith('multipart/form-data');
        
        // Se o usuário já foi verificado pelo authMiddleware
        if (req.user) {
            // Se a flag req.isAdmin foi definida, usar ela
            if (req.isAdmin === true) {
                return next();
            }

            // Verificar se o usuário tem a role admin
            const isAdmin = req.user.userRoles && 
                        req.user.userRoles.some(role => role.name.toLowerCase() === 'admin');
            
            if (!isAdmin) {
                logger.warn('Acesso admin negado: Usuário não é admin', {
                    userId: req.user.id,
                    email: req.user.email,
                    roles: req.user.userRoles.map(r => r.name),
                    path: req.path
                });
                
                if (req.accepts('html')) {
                    return res.redirect('/modules/learning/templates/admin-redirect.html');
                } else {
                    return res.status(403).json({ error: 'Acesso negado. Permissão de administrador necessária.' });
                }
            }
            
            // Marcar o usuário como admin para verificações futuras
            req.isAdmin = true;
            return next();
        }
        
        // Se o usuário não foi verificado, extrair token
        const extractToken = (req) => {
            if (req.cookies?.auth_token) {
                return req.cookies.auth_token;
            }
            
            if (req.headers.authorization) {
                return req.headers.authorization.replace(/^(Bearer|Token)\s+/i, '');
            }
            
            return null;
        };
        
        const token = extractToken(req);
        
        if (!token) {
            logger.warn('Acesso admin negado: Token não fornecido', {
                path: req.path,
                method: req.method,
                contentType: req.headers['content-type'] || 'não especificado'
            });
            
            if (isMultipartRequest) {
                // Para uploads, retornar um erro JSON em vez de redirecionar
                return res.status(401).json({ error: 'Acesso negado. Autenticação necessária.' });
            } else if (req.accepts('html')) {
                return res.redirect('/modules/learning/templates/admin-redirect.html');
            } else {
                return res.status(401).json({ error: 'Acesso negado. Autenticação necessária.' });
            }
        }
        
        try {
            // Verificar token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Buscar usuário com suas roles
            const user = await User.findByPk(decoded.id, {
                include: [{
                    model: Role,
                    as: 'userRoles'
                }]
            });
            
            if (!user) {
                logger.warn('Acesso admin negado: Usuário não encontrado', {
                    tokenId: decoded.id,
                    path: req.path
                });
                
                if (req.accepts('html')) {
                    return res.redirect('/modules/learning/templates/admin-redirect.html');
                } else {
                    return res.status(401).json({ error: 'Usuário não encontrado.' });
                }
            }
            
            // Verificar se o usuário é admin
            const isAdmin = user.userRoles && 
                          user.userRoles.some(role => role.name.toLowerCase() === 'admin');
            
            if (!isAdmin) {
                logger.warn('Acesso admin negado: Usuário não é admin', {
                    userId: user.id,
                    email: user.email,
                    roles: user.userRoles.map(r => r.name),
                    path: req.path
                });
                
                if (isMultipartRequest) {
                    // Para uploads, retornar um erro JSON em vez de redirecionar
                    return res.status(403).json({ error: 'Acesso negado. Permissão de administrador necessária.' });
                } else if (req.accepts('html')) {
                    return res.redirect('/modules/learning/templates/admin-redirect.html');
                } else {
                    return res.status(403).json({ error: 'Acesso negado. Permissão de administrador necessária.' });
                }
            }
            
            // Adicionar usuário ao request para uso futuro
            req.user = user;
            req.isAdmin = true;
            
            next();
        } catch (error) {
            logger.error('Erro ao verificar token admin:', error);
            
            if (isMultipartRequest) {
                // Para uploads, retornar um erro JSON em vez de redirecionar
                return res.status(401).json({ error: 'Token inválido ou expirado.' });
            } else if (req.accepts('html')) {
                return res.redirect('/modules/learning/templates/admin-redirect.html');
            } else {
                return res.status(401).json({ error: 'Token inválido ou expirado.' });
            }
        }
    } catch (error) {
        logger.error('Erro no middleware requireAdmin:', error);
        
        if (isMultipartRequest) {
            // Para uploads, retornar um erro JSON em vez de redirecionar
            return res.status(500).json({ error: 'Erro interno do servidor.' });
        } else if (req.accepts('html')) {
            return res.redirect('/modules/learning/templates/admin-redirect.html');
        } else {
            return res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    }
};

// Função para criar usuário admin inicial
async function ensureAdmin() {
    try {
        // Obter configurações do admin do .env
        const adminConfig = getDefaultAdminConfig();
        
        // Criar role admin se não existir
        const [adminRole] = await Role.findOrCreate({
            where: { name: 'admin' },
            defaults: {
                description: 'Administrador do sistema'
            }
        });

        // Criar ou atualizar usuário admin
        const [adminUser, created] = await User.findOrCreate({
            where: { email: adminConfig.email },
            defaults: {
                username: adminConfig.username,
                name: adminConfig.name,
                password: adminConfig.password, // O hook beforeSave irá criptografar automaticamente
                is_admin: adminConfig.isAdmin,
                email_verified: adminConfig.emailVerified,
                is_active: adminConfig.isActive
            }
        });

        // Se o usuário já existia, atualizar as configurações
        if (!created) {
            await adminUser.update({
                password: adminConfig.password, // O hook beforeSave irá criptografar automaticamente
                is_admin: adminConfig.isAdmin,
                email_verified: adminConfig.emailVerified,
                is_active: adminConfig.isActive
            });
        }

        // Garantir que o usuário tem a role admin
        const hasAdminRole = await adminUser.hasRole(adminRole.name);
        if (!hasAdminRole) {
            // Usar método direto de associação via sequelize
            await sequelize.models.user_roles.create({
                user_id: adminUser.id,
                role_id: adminRole.id
            });
            logger.info('Role admin adicionada ao usuário:', {
                userId: adminUser.id,
                roleId: adminRole.id
            });
        }

        logger.info('Usuário admin criado/atualizado com sucesso', {
            userId: adminUser.id,
            email: adminUser.email,
            created: created
        });
        
        return adminUser;
    } catch (error) {
        logger.error('Erro ao criar usuário admin:', error);
        throw error;
    }
}

module.exports = { ensureAdmin, requireAdmin }; 