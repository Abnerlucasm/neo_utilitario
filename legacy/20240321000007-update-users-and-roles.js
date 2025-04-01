'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            // Criar extensão uuid se não existir
            await queryInterface.sequelize.query(`
                CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            `);

            // Criar tabela user_roles se não existir
            const tables = await queryInterface.showAllTables();
            if (!tables.includes('user_roles')) {
                await queryInterface.createTable('user_roles', {
                    user_id: {
                        type: Sequelize.INTEGER,
                        allowNull: false,
                        references: {
                            model: 'users',
                            key: 'id'
                        },
                        onDelete: 'CASCADE'
                    },
                    role_id: {
                        type: Sequelize.INTEGER,
                        allowNull: false,
                        references: {
                            model: 'roles',
                            key: 'id'
                        },
                        onDelete: 'CASCADE'
                    },
                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false
                    },
                    updated_at: {
                        type: Sequelize.DATE,
                        allowNull: false
                    }
                });

                await queryInterface.addConstraint('user_roles', {
                    fields: ['user_id', 'role_id'],
                    type: 'primary key',
                    name: 'user_roles_pkey'
                });
            }

            // Modificar a tabela services para usar INTEGER em vez de UUID
            await queryInterface.sequelize.query(`
                ALTER TABLE services
                ALTER COLUMN assigned_to TYPE INTEGER USING CASE 
                    WHEN assigned_to IS NULL THEN NULL 
                    ELSE 0 
                END,
                ALTER COLUMN created_by TYPE INTEGER USING CASE 
                    WHEN created_by IS NULL THEN NULL 
                    ELSE 0 
                END;
            `);

            // Adicionar as foreign keys corretas
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
            // Remover foreign keys
            await queryInterface.sequelize.query(`
                ALTER TABLE services
                DROP CONSTRAINT IF EXISTS services_assigned_to_fkey,
                DROP CONSTRAINT IF EXISTS services_created_by_fkey;
            `);

            // Dropar tabela user_roles
            await queryInterface.dropTable('user_roles');

        } catch (error) {
            console.error('Erro no rollback:', error);
            throw error;
        }
    }
}; 