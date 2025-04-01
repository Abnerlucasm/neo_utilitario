const jwt = require('jsonwebtoken');
const { User, Role } = require('../models/postgresql/associations');
const logger = require('../utils/logger');

/**
 * Middleware de autenticação para rotas protegidas
 */
module.exports = async (req, res, next) => {
    try {
        // Obter token do cabeçalho Authorization ou do cookie
        const token = req.cookies.auth_token || 
                     req.headers.authorization?.split(' ')[1];

        if (!token) {
            logger.warn('Acesso sem token de autenticação', {
                path: req.path,
                method: req.method,
                ip: req.ip
            });
            return res.status(401).json({ error: 'Autenticação necessária' });
        }

        // Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Buscar usuário com funções
        const user = await User.findByPk(decoded.id, {
            include: [{
                model: Role,
                as: 'userRoles'
            }]
        });

        if (!user) {
            logger.warn('Token com usuário inexistente', {
                userId: decoded.id,
                path: req.path
            });
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }

        if (!user.is_active) {
            logger.warn('Tentativa de acesso com usuário inativo', {
                userId: user.id,
                username: user.username,
                path: req.path
            });
            return res.status(403).json({ error: 'Usuário inativo' });
        }

        // Verificar se é admin (se necessário para esta rota)
        const isAdmin = user.userRoles && 
                       user.userRoles.some(role => role.name.toLowerCase() === 'admin');

        // Adicionar usuário ao request
        req.user = user;
        
        // Atualizar último login
        user.last_login = new Date();
        await user.save();
        
        next();
    } catch (error) {
        logger.error('Erro na autenticação:', error);
        res.status(401).json({ error: 'Token inválido' });
    }
};

// Exportar tanto a função direta quanto os métodos nomeados
module.exports.requireAuth = module.exports;
module.exports.authenticate = module.exports; 