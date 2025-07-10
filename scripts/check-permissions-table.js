const { sequelize, Permission } = require('../models/postgresql/associations');
const logger = require('../utils/logger');

async function checkPermissionsTable() {
    try {
        logger.info('Verificando tabela de permissões...');
        
        // Verificar se a tabela existe
        const tableExists = await sequelize.getQueryInterface().showAllTables()
            .then(tables => tables.includes('permissions'));
        
        if (!tableExists) {
            logger.info('Tabela permissions não existe. Criando...');
            await sequelize.sync({ force: false });
            logger.info('Tabela permissions criada com sucesso.');
        } else {
            logger.info('Tabela permissions já existe.');
        }
        
        // Verificar se há permissões
        const permissionCount = await Permission.count();
        logger.info(`Encontradas ${permissionCount} permissões no banco de dados.`);
        
        if (permissionCount === 0) {
            logger.info('Criando permissões padrão...');
            
            const defaultPermissions = [
                {
                    name: 'user.read',
                    description: 'Ler informações de usuários',
                    resource: 'users',
                    action: 'read'
                },
                {
                    name: 'user.create',
                    description: 'Criar novos usuários',
                    resource: 'users',
                    action: 'create'
                },
                {
                    name: 'user.update',
                    description: 'Atualizar informações de usuários',
                    resource: 'users',
                    action: 'update'
                },
                {
                    name: 'user.delete',
                    description: 'Excluir usuários',
                    resource: 'users',
                    action: 'delete'
                },
                {
                    name: 'role.read',
                    description: 'Ler informações de papéis',
                    resource: 'roles',
                    action: 'read'
                },
                {
                    name: 'role.create',
                    description: 'Criar novos papéis',
                    resource: 'roles',
                    action: 'create'
                },
                {
                    name: 'role.update',
                    description: 'Atualizar informações de papéis',
                    resource: 'roles',
                    action: 'update'
                },
                {
                    name: 'role.delete',
                    description: 'Excluir papéis',
                    resource: 'roles',
                    action: 'delete'
                },
                {
                    name: 'permission.read',
                    description: 'Ler informações de permissões',
                    resource: 'permissions',
                    action: 'read'
                },
                {
                    name: 'permission.create',
                    description: 'Criar novas permissões',
                    resource: 'permissions',
                    action: 'create'
                },
                {
                    name: 'permission.update',
                    description: 'Atualizar informações de permissões',
                    resource: 'permissions',
                    action: 'update'
                },
                {
                    name: 'permission.delete',
                    description: 'Excluir permissões',
                    resource: 'permissions',
                    action: 'delete'
                },
                {
                    name: 'menu.read',
                    description: 'Ler informações de menus',
                    resource: 'menus',
                    action: 'read'
                },
                {
                    name: 'menu.create',
                    description: 'Criar novos menus',
                    resource: 'menus',
                    action: 'create'
                },
                {
                    name: 'menu.update',
                    description: 'Atualizar informações de menus',
                    resource: 'menus',
                    action: 'update'
                },
                {
                    name: 'menu.delete',
                    description: 'Excluir menus',
                    resource: 'menus',
                    action: 'delete'
                }
            ];
            
            await Permission.bulkCreate(defaultPermissions);
            logger.info(`${defaultPermissions.length} permissões padrão criadas com sucesso.`);
        }
        
        logger.info('Verificação da tabela de permissões concluída com sucesso!');
        return true;
        
    } catch (error) {
        logger.error('Erro ao verificar tabela de permissões:', error);
        throw error;
    }
}

// Executar se este arquivo for chamado diretamente
if (require.main === module) {
    (async () => {
        try {
            await checkPermissionsTable();
            process.exit(0);
        } catch (error) {
            console.error('Erro ao executar verificação:', error);
            process.exit(1);
        }
    })();
}

module.exports = checkPermissionsTable; 