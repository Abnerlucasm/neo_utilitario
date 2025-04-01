'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            // Primeiro, remover os valores padrão
            await queryInterface.sequelize.query(`
                ALTER TABLE services 
                ALTER COLUMN status DROP DEFAULT,
                ALTER COLUMN priority DROP DEFAULT;
            `);

            // Remover as restrições de ENUM existentes
            await queryInterface.sequelize.query(`
                ALTER TABLE services 
                ALTER COLUMN status TYPE VARCHAR(255) USING status::text,
                ALTER COLUMN priority TYPE VARCHAR(255) USING priority::text;
            `);

            // Dropar os tipos ENUM existentes
            await queryInterface.sequelize.query(`
                DROP TYPE IF EXISTS enum_services_status;
                DROP TYPE IF EXISTS enum_services_priority;
            `);

            // Criar os novos tipos ENUM
            await queryInterface.sequelize.query(`
                CREATE TYPE enum_services_status AS ENUM ('backlog', 'todo', 'in_progress', 'done', 'archived');
                CREATE TYPE enum_services_priority AS ENUM ('low', 'medium', 'high', 'urgent');
            `);

            // Atualizar valores existentes para valores válidos do ENUM
            await queryInterface.sequelize.query(`
                UPDATE services 
                SET status = 'backlog' 
                WHERE status NOT IN ('backlog', 'todo', 'in_progress', 'done', 'archived')
                OR status IS NULL;

                UPDATE services 
                SET priority = 'medium' 
                WHERE priority NOT IN ('low', 'medium', 'high', 'urgent')
                OR priority IS NULL;
            `);

            // Converter as colunas para usar os novos tipos ENUM
            await queryInterface.sequelize.query(`
                ALTER TABLE services 
                ALTER COLUMN status TYPE enum_services_status USING status::enum_services_status,
                ALTER COLUMN priority TYPE enum_services_priority USING priority::enum_services_priority;
            `);

            // Definir valores padrão
            await queryInterface.sequelize.query(`
                ALTER TABLE services 
                ALTER COLUMN status SET DEFAULT 'backlog',
                ALTER COLUMN priority SET DEFAULT 'medium';
            `);

        } catch (error) {
            console.error('Erro na migração:', error);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        try {
            // Remover valores padrão
            await queryInterface.sequelize.query(`
                ALTER TABLE services 
                ALTER COLUMN status DROP DEFAULT,
                ALTER COLUMN priority DROP DEFAULT;
            `);

            // Converter de volta para VARCHAR
            await queryInterface.sequelize.query(`
                ALTER TABLE services 
                ALTER COLUMN status TYPE VARCHAR(255) USING status::text,
                ALTER COLUMN priority TYPE VARCHAR(255) USING priority::text;
            `);

            // Remover os tipos ENUM
            await queryInterface.sequelize.query(`
                DROP TYPE IF EXISTS enum_services_status;
                DROP TYPE IF EXISTS enum_services_priority;
            `);

            // Definir valores padrão string
            await queryInterface.sequelize.query(`
                ALTER TABLE services 
                ALTER COLUMN status SET DEFAULT 'backlog',
                ALTER COLUMN priority SET DEFAULT 'medium';
            `);
        } catch (error) {
            console.error('Erro no rollback:', error);
            throw error;
        }
    }
}; 