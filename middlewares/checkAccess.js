const { User, Role, Resource, Permission } = require('../models/postgresql/associations');
const logger = require('../utils/logger');

const checkAccess = (resourcePath) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Não autenticado' });
            }

            // Buscar usuário com seus papéis
            const user = await User.findByPk(req.user.id, {
                include: [{
                    model: Role,
                    as: 'userRoles',
                    include: [{
                        model: Permission,
                        as: 'permissions'
                    }]
                }]
            });

            // Verificar se o usuário tem permissão para acessar o recurso
            let hasPermission = false;

            // Verificar se é um administrador
            const isAdmin = user.userRoles && 
                           user.userRoles.some(role => role.name.toLowerCase() === 'admin');
            
            // Se for admin, tem acesso a tudo
            if (isAdmin) return next();

            // Percorrer as roles do usuário
            for (const role of user.userRoles || []) {
                // Verificar se o usuário tem acesso ao recurso
                const hasAccess = role.resources.some(resource => 
                    resource.path === resourcePath && resource.isActive
                );

                if (hasAccess) {
                    hasPermission = true;
                    break;
                }
            }

            if (!hasPermission) {
                logger.warn(`Acesso negado para usuário ${user.email} ao recurso ${resourcePath}`);
                return res.status(403).json({ error: 'Acesso negado' });
            }

            next();
        } catch (error) {
            logger.error('Erro ao verificar acesso:', error);
            res.status(500).json({ error: 'Erro ao verificar acesso' });
        }
    };
};

module.exports = checkAccess; 