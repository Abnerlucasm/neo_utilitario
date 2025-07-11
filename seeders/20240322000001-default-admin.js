'use strict';
const bcrypt = require('bcryptjs');
const { getDefaultAdminConfig } = require('../utils/admin-config');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const now = new Date();
        
        // 1. Verificar se o papel admin já existe
        const [existingRole] = await queryInterface.sequelize.query(
            'SELECT id FROM roles WHERE name = :name',
            {
                replacements: { name: 'Administrador' },
                type: Sequelize.QueryTypes.SELECT
            }
        );

        let adminRoleId;
        
        if (!existingRole) {
            // Criar papel de admin se não existir
            const [adminRole] = await queryInterface.bulkInsert('roles', [{
                id: Sequelize.literal('uuid_generate_v4()'),
                name: 'Administrador',
                description: 'Acesso total ao sistema',
                created_at: now,
                updated_at: now
            }], { returning: true });
            adminRoleId = adminRole.id;
        } else {
            adminRoleId = existingRole.id;
        }

        // 2. Verificar se o usuário admin já existe
        const adminConfig = getDefaultAdminConfig();
        const [existingUser] = await queryInterface.sequelize.query(
            'SELECT id FROM users WHERE email = :email',
            {
                replacements: { email: adminConfig.email },
                type: Sequelize.QueryTypes.SELECT
            }
        );

        let adminUserId;

        if (!existingUser) {
            // Criar usuário admin se não existir
            const hashedPassword = await bcrypt.hash(adminConfig.password, 10);
            const [adminUser] = await queryInterface.bulkInsert('users', [{
                id: Sequelize.literal('uuid_generate_v4()'),
                name: adminConfig.name,
                email: adminConfig.email,
                password: hashedPassword,
                is_active: adminConfig.isActive,
                email_verified: adminConfig.emailVerified,
                two_factor_enabled: false,
                created_at: now,
                updated_at: now
            }], { returning: true });
            adminUserId = adminUser.id;

            // 3. Associar usuário ao papel de admin
            await queryInterface.bulkInsert('user_roles', [{
                user_id: adminUserId,
                role_id: adminRoleId,
                created_at: now,
                updated_at: now
            }]);
        }

        console.log('Configuração de admin concluída');
    },

    down: async (queryInterface, Sequelize) => {
        // Remover na ordem inversa para evitar problemas de chave estrangeira
        const adminConfig = getDefaultAdminConfig();
        await queryInterface.bulkDelete('role_permissions', null, {});
        await queryInterface.bulkDelete('user_roles', null, {});
        await queryInterface.bulkDelete('users', {
            email: adminConfig.email
        }, {});
        await queryInterface.bulkDelete('roles', {
            name: 'Administrador'
        }, {});
    }
}; 