'use strict';

const logger = require('../../utils/logger');
const {
    sequelize,
    User,
    Role,
    Permission,
    LearningModule,
    UserProgress,
    Service,
    Session,
    Resource,
    Suggestion,
    Glassfish,
    Menu,
    initAssociations
} = require('./associations');

async function createDefaultAdmin() {
    try {
        // Criar role admin se não existir
        const [adminRole] = await Role.findOrCreate({
            where: { name: 'admin' },
            defaults: {
                description: 'Administrador do sistema'
            }
        });

        // Criar ou atualizar usuário admin
        const [adminUser, created] = await User.findOrCreate({
            where: { email: 'abner.freitas@neosistemas.com.br' },
            defaults: {
                username: 'admin',
                name: 'Administrador',
                password: 'admin', // O hook beforeSave irá criptografar automaticamente
                is_admin: true,
                email_verified: true,
                is_active: true
            }
        });

        // Se o usuário já existia, atualizar a senha
        if (!created) {
            await adminUser.update({
                password: 'admin', // O hook beforeSave irá criptografar automaticamente
                is_admin: true,
                email_verified: true,
                is_active: true
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
        
        // Modificar a estratégia de sincronização para evitar problemas com o campo keywords
        try {
            // Primeiro, tentar sincronizar sem alterar a estrutura
            await sequelize.sync({ alter: false });
            logger.info('Sincronização inicial concluída sem alterações na estrutura');
            
            // Em seguida, executar queries personalizadas para garantir que o campo keywords seja JSONB
            try {
                // Verificar se a coluna já existe e seu tipo
                const [results] = await sequelize.query(`
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'learning_modules' AND column_name = 'keywords'
                `);
                
                if (results.length === 0) {
                    // A coluna não existe, adicionar como JSONB
                    await sequelize.query(`
                        ALTER TABLE learning_modules 
                        ADD COLUMN keywords JSONB DEFAULT '[]'::jsonb
                    `);
                    logger.info('Coluna keywords adicionada como JSONB');
                } else if (results[0].data_type !== 'jsonb') {
                    // A coluna existe mas não é JSONB, converter
                    await sequelize.query(`
                        ALTER TABLE learning_modules 
                        ALTER COLUMN keywords TYPE JSONB USING keywords::jsonb
                    `);
                    logger.info('Coluna keywords convertida para JSONB');
                }
            } catch (error) {
                logger.warn('Erro ao verificar/modificar coluna keywords:', error);
                // Continuar mesmo com erro
            }
        } catch (error) {
            logger.warn('Erro na sincronização sem alterações, tentando com força bruta:', error);
            
            // Se falhar, tentar com force
            await sequelize.sync({ force: false });
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
    LearningModule,
    UserProgress,
    Service,
    Session,
    Resource,
    Suggestion,
    Glassfish,
    Menu
}; 