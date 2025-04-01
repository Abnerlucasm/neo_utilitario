'use strict';

const { sequelize } = require('../config/database');
const { 
    User, 
    Role, 
    Permission, 
    Resource, 
    LearningModule, 
    UserProgress,
    RolePermission,
    UserRole,
    RoleResource
} = require('../models/postgresql/associations');
const logger = require('../utils/logger');

async function checkAssociations() {
    try {
        // Verificar conexão com banco de dados
        await sequelize.authenticate();
        console.log('Conexão com o banco de dados OK');

        // Verificar modelos carregados
        console.log('\n===== Verificando modelos =====');
        const models = [
            { name: 'User', model: User },
            { name: 'Role', model: Role },
            { name: 'Permission', model: Permission },
            { name: 'Resource', model: Resource },
            { name: 'LearningModule', model: LearningModule },
            { name: 'UserProgress', model: UserProgress },
            { name: 'RolePermission', model: RolePermission },
            { name: 'UserRole', model: UserRole },
            { name: 'RoleResource', model: RoleResource }
        ];

        models.forEach(({ name, model }) => {
            if (model) {
                console.log(`✅ Modelo ${name} carregado corretamente`);
            } else {
                console.log(`❌ ERRO: Modelo ${name} não foi carregado`);
            }
        });

        // Verificar associações
        console.log('\n===== Verificando associações =====');
        
        // User -> Roles
        try {
            const userAssociations = Object.keys(User.associations);
            console.log(`Associações do User: ${userAssociations.join(', ')}`);
            if (userAssociations.includes('userRoles')) {
                console.log('✅ User -> userRoles: OK');
            } else {
                console.log('❌ ERRO: User não tem associação com userRoles');
            }
        } catch (error) {
            console.log('❌ ERRO ao verificar associações do User:', error.message);
        }

        // Role -> Resources e Permission
        try {
            const roleAssociations = Object.keys(Role.associations);
            console.log(`Associações do Role: ${roleAssociations.join(', ')}`);
            
            if (roleAssociations.includes('permissions')) {
                console.log('✅ Role -> permissions: OK');
            } else {
                console.log('❌ ERRO: Role não tem associação com permissions');
            }
            
            if (roleAssociations.includes('accessibleResources')) {
                console.log('✅ Role -> accessibleResources: OK');
            } else {
                console.log('❌ ERRO: Role não tem associação com accessibleResources');
            }
        } catch (error) {
            console.log('❌ ERRO ao verificar associações do Role:', error.message);
        }

        // Resource -> Roles
        try {
            const resourceAssociations = Object.keys(Resource.associations);
            console.log(`Associações do Resource: ${resourceAssociations.join(', ')}`);
            
            if (resourceAssociations.includes('accessRoles')) {
                console.log('✅ Resource -> accessRoles: OK');
            } else {
                console.log('❌ ERRO: Resource não tem associação com accessRoles');
            }
        } catch (error) {
            console.log('❌ ERRO ao verificar associações do Resource:', error.message);
        }

        // Permission -> Roles
        try {
            const permissionAssociations = Object.keys(Permission.associations);
            console.log(`Associações do Permission: ${permissionAssociations.join(', ')}`);
            
            if (permissionAssociations.includes('roles')) {
                console.log('✅ Permission -> roles: OK');
            } else {
                console.log('❌ ERRO: Permission não tem associação com roles');
            }
        } catch (error) {
            console.log('❌ ERRO ao verificar associações do Permission:', error.message);
        }

        // LearningModule -> UserProgress
        try {
            const moduleAssociations = Object.keys(LearningModule.associations);
            console.log(`Associações do LearningModule: ${moduleAssociations.join(', ')}`);
            
            if (moduleAssociations.includes('userProgresses')) {
                console.log('✅ LearningModule -> userProgresses: OK');
            } else {
                console.log('❌ ERRO: LearningModule não tem associação com userProgresses');
            }
        } catch (error) {
            console.log('❌ ERRO ao verificar associações do LearningModule:', error.message);
        }

        // Verificar tabelas no banco
        console.log('\n===== Verificando tabelas no banco =====');
        const tables = await sequelize.getQueryInterface().showAllTables();
        
        console.log('Tabelas encontradas no banco:');
        tables.forEach(table => {
            console.log(`- ${table}`);
        });

        const requiredTables = [
            'users', 'roles', 'permissions', 'resources', 
            'user_roles', 'role_permissions', 'role_resources',
            'learning_modules', 'user_progress'
        ];
        
        const missingTables = requiredTables.filter(table => !tables.includes(table));
        
        if (missingTables.length === 0) {
            console.log('✅ Todas as tabelas necessárias estão presentes no banco');
        } else {
            console.log('❌ ERRO: Tabelas faltando no banco:', missingTables.join(', '));
            console.log('Sugestão: Execute "npm run run-migrations" para criar as tabelas faltantes');
        }

        // Testar consulta de usuário com roles
        try {
            console.log('\n===== Testando consulta de usuário com roles =====');
            const userWithRoles = await User.findOne({
                include: [{
                    model: Role,
                    as: 'userRoles'
                }]
            });
            
            if (userWithRoles) {
                console.log('✅ Consulta de usuário com roles realizada com sucesso');
                console.log(`Usuário: ${userWithRoles.username}`);
                console.log(`Roles: ${userWithRoles.userRoles ? userWithRoles.userRoles.length : 0}`);
            } else {
                console.log('⚠️ Nenhum usuário encontrado para testar as associações');
            }
        } catch (error) {
            console.log('❌ ERRO ao consultar usuário com roles:', error.message);
        }

        console.log('\n✅ Verificação de associações concluída');
        await sequelize.close();
    } catch (error) {
        console.error('Erro ao verificar associações:', error);
        process.exit(1);
    }
}

// Executar verificação
checkAssociations(); 