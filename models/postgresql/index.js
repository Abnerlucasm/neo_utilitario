'use strict';

const logger = require('../../utils/logger');
const { getDefaultAdminConfig } = require('../../utils/admin-config');
const {
    sequelize,
    User,
    Role,
    Permission,
    Service,
    Session,
    Resource,
    Suggestion,
    Glassfish,
    Menu,
    Server,
    initAssociations
} = require('./associations');

async function createDefaultAdmin() {
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
        try {
            // Verificar se a associação já existe
            const existingAssociation = await sequelize.models.user_roles.findOne({
                where: {
                    user_id: adminUser.id,
                    role_id: adminRole.id
                }
            });
            
            // Se não existir, criar a associação
            if (!existingAssociation) {
                await sequelize.models.user_roles.create({
                    user_id: adminUser.id,
                    role_id: adminRole.id
                });
                logger.info('Role admin adicionada ao usuário admin');
            } else {
                logger.info('Usuário admin já possui a role admin');
            }
        } catch (error) {
            logger.error('Erro ao adicionar role admin ao usuário:', error);
        }

        logger.info('Usuário admin criado/atualizado com sucesso', {
            userId: adminUser.id,
            email: adminUser.email,
            created: created
        });
    } catch (error) {
        logger.error('Erro ao criar usuário admin:', error);
        throw error;
    }
}

/**
 * Inicializa o banco de dados, criando as tabelas se necessário
 */
async function initDatabase() {
    try {
        // Verificar se as associações já foram inicializadas
        if (!User.associations || !User.associations.userRoles) {
            // Inicializar associações
            initAssociations();
            
            // Log para debugging
            logger.info('Associações inicializadas', {
                userAssociations: Object.keys(User.associations || {}),
                roleAssociations: Object.keys(Role.associations || {})
            });
        } else {
            logger.info('Associações já foram inicializadas anteriormente');
        }
                
        logger.info('Banco de dados inicializado com sucesso');

        // Criar roles padrão
        const roles = ['admin', 'user'];
        for (const roleName of roles) {
            await Role.findOrCreate({
                where: { name: roleName },
                defaults: {
                    description: `Role padrão de ${roleName}`
                }
            });
        }

        logger.info('Roles padrão criadas/verificadas com sucesso');

        // Criar usuário admin padrão
        await createDefaultAdmin();

        return true;
    } catch (error) {
        logger.error('Erro ao inicializar banco de dados:', error);
        throw error;
    }
}

module.exports = {
    initDatabase,
    sequelize,
    User,
    Role,
    Permission,
    Service,
    Session,
    Resource,
    Suggestion,
    Glassfish,
    Menu,
    Server,
    DatabaseCache: require('./associations').DatabaseCache,
}; 