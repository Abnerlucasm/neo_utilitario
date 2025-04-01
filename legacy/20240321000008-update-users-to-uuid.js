'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            // Criar extensão uuid se não existir
            await queryInterface.sequelize.query(`
                CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            `);

            // Criar tabela temporária com a nova estrutura
            await queryInterface.sequelize.query(`
                CREATE TABLE users_new (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    username VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL,
                    name VARCHAR(255),
                    theme VARCHAR(255) DEFAULT 'light',
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL
                );
            `);

            // Copiar dados da tabela antiga para a nova, gerando novos UUIDs
            await queryInterface.sequelize.query(`
                INSERT INTO users_new (username, email, password, name, theme, created_at, updated_at)
                SELECT username, email, password, name, theme, created_at, updated_at
                FROM users;
            `);

            // Criar tabela de mapeamento para preservar as referências
            await queryInterface.sequelize.query(`
                CREATE TABLE user_id_mapping (
                    old_id INTEGER PRIMARY KEY,
                    new_id UUID NOT NULL
                );

                INSERT INTO user_id_mapping (old_id, new_id)
                SELECT users.id, users_new.id
                FROM users
                JOIN users_new ON users.email = users_new.email;
            `);

            // Atualizar referências em outras tabelas
            await queryInterface.sequelize.query(`
                ALTER TABLE services
                ALTER COLUMN assigned_to TYPE UUID USING 
                    (SELECT new_id FROM user_id_mapping WHERE old_id = assigned_to::integer),
                ALTER COLUMN created_by TYPE UUID USING 
                    (SELECT new_id FROM user_id_mapping WHERE old_id = created_by::integer);
            `);

            // Backup da tabela antiga
            await queryInterface.sequelize.query(`
                ALTER TABLE users RENAME TO users_old;
                ALTER TABLE users_new RENAME TO users;
            `);

            // Recriar índices e constraints
            await queryInterface.sequelize.query(`
                ALTER TABLE services
                ADD CONSTRAINT services_assigned_to_fkey 
                    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
                ADD CONSTRAINT services_created_by_fkey 
                    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
            `);

        } catch (error) {
            console.error('Erro na migração:', error);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        try {
            // Restaurar tabela antiga
            await queryInterface.sequelize.query(`
                DROP TABLE IF EXISTS users CASCADE;
                ALTER TABLE users_old RENAME TO users;
            `);

            // Restaurar os tipos originais das colunas em services
            await queryInterface.sequelize.query(`
                ALTER TABLE services
                ALTER COLUMN assigned_to TYPE INTEGER USING 
                    (SELECT old_id FROM user_id_mapping WHERE new_id = assigned_to::uuid),
                ALTER COLUMN created_by TYPE INTEGER USING 
                    (SELECT old_id FROM user_id_mapping WHERE new_id = created_by::uuid);
            `);

            // Limpar tabelas temporárias
            await queryInterface.sequelize.query(`
                DROP TABLE IF EXISTS user_id_mapping;
            `);

        } catch (error) {
            console.error('Erro no rollback:', error);
            throw error;
        }
    }
}; 