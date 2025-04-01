'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            // Remover as constraints existentes
            await queryInterface.sequelize.query(`
                ALTER TABLE IF EXISTS services 
                DROP CONSTRAINT IF EXISTS services_assigned_to_fkey,
                DROP CONSTRAINT IF EXISTS services_created_by_fkey;
            `);

            await queryInterface.sequelize.query(`
                ALTER TABLE IF EXISTS user_roles
                DROP CONSTRAINT IF EXISTS user_roles_role_id_fkey,
                DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
            `);

            // Atualizar o tipo das colunas para UUID
            await queryInterface.sequelize.query(`
                ALTER TABLE services
                ALTER COLUMN assigned_to TYPE UUID USING assigned_to::uuid,
                ALTER COLUMN created_by TYPE UUID USING created_by::uuid;
            `);

            await queryInterface.sequelize.query(`
                ALTER TABLE user_roles
                ALTER COLUMN role_id TYPE UUID USING role_id::uuid,
                ALTER COLUMN user_id TYPE UUID USING user_id::uuid;
            `);

            // Recriar as foreign keys com o tipo correto
            await queryInterface.sequelize.query(`
                ALTER TABLE services
                ADD CONSTRAINT services_assigned_to_fkey 
                    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
                ADD CONSTRAINT services_created_by_fkey 
                    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
            `);

            await queryInterface.sequelize.query(`
                ALTER TABLE user_roles
                ADD CONSTRAINT user_roles_role_id_fkey 
                    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE ON UPDATE CASCADE,
                ADD CONSTRAINT user_roles_user_id_fkey 
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
            `);

        } catch (error) {
            console.error('Erro na migração:', error);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        try {
            // Remover as constraints
            await queryInterface.sequelize.query(`
                ALTER TABLE IF EXISTS services 
                DROP CONSTRAINT IF EXISTS services_assigned_to_fkey,
                DROP CONSTRAINT IF EXISTS services_created_by_fkey;
            `);

            await queryInterface.sequelize.query(`
                ALTER TABLE IF EXISTS user_roles
                DROP CONSTRAINT IF EXISTS user_roles_role_id_fkey,
                DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
            `);

        } catch (error) {
            console.error('Erro no rollback:', error);
            throw error;
        }
    }
}; 