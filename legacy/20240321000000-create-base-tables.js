'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            // Criar extensão uuid se não existir
            await queryInterface.sequelize.query(`
                CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            `);

            // Criar tabela users
            await queryInterface.createTable('users', {
                id: {
                    type: Sequelize.UUID,
                    defaultValue: Sequelize.literal('uuid_generate_v4()'),
                    primaryKey: true
                },
                username: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    unique: true
                },
                email: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    unique: true
                },
                password: {
                    type: Sequelize.STRING,
                    allowNull: false
                },
                name: {
                    type: Sequelize.STRING
                },
                theme: {
                    type: Sequelize.STRING,
                    defaultValue: 'light'
                },
                reset_token: {
                    type: Sequelize.STRING
                },
                reset_token_expires: {
                    type: Sequelize.DATE
                },
                is_active: {
                    type: Sequelize.BOOLEAN,
                    defaultValue: true
                },
                email_verified: {
                    type: Sequelize.BOOLEAN,
                    defaultValue: false
                },
                is_admin: {
                    type: Sequelize.BOOLEAN,
                    defaultValue: false
                },
                verification_code: {
                    type: Sequelize.STRING
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

            // Criar tabela roles
            await queryInterface.createTable('roles', {
                id: {
                    type: Sequelize.UUID,
                    defaultValue: Sequelize.literal('uuid_generate_v4()'),
                    primaryKey: true
                },
                name: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    unique: true
                },
                description: {
                    type: Sequelize.TEXT
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

            // Criar tabela user_roles
            await queryInterface.createTable('user_roles', {
                user_id: {
                    type: Sequelize.UUID,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onDelete: 'CASCADE'
                },
                role_id: {
                    type: Sequelize.UUID,
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

            // Criar tabela learning_modules
            await queryInterface.createTable('learning_modules', {
                id: {
                    type: Sequelize.UUID,
                    defaultValue: Sequelize.literal('uuid_generate_v4()'),
                    primaryKey: true
                },
                title: {
                    type: Sequelize.STRING,
                    allowNull: false
                },
                description: {
                    type: Sequelize.TEXT
                },
                content: {
                    type: Sequelize.JSONB
                },
                created_by: {
                    type: Sequelize.UUID,
                    references: {
                        model: 'users',
                        key: 'id'
                    }
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

            // Criar tabela user_progress
            await queryInterface.createTable('user_progress', {
                id: {
                    type: Sequelize.UUID,
                    defaultValue: Sequelize.literal('uuid_generate_v4()'),
                    primaryKey: true
                },
                user_id: {
                    type: Sequelize.UUID,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onDelete: 'CASCADE'
                },
                module_id: {
                    type: Sequelize.UUID,
                    references: {
                        model: 'learning_modules',
                        key: 'id'
                    },
                    onDelete: 'CASCADE'
                },
                progress: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0
                },
                completed: {
                    type: Sequelize.BOOLEAN,
                    defaultValue: false
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

            // Criar tabela services
            await queryInterface.createTable('services', {
                id: {
                    type: Sequelize.UUID,
                    defaultValue: Sequelize.literal('uuid_generate_v4()'),
                    primaryKey: true
                },
                title: {
                    type: Sequelize.STRING,
                    allowNull: false
                },
                description: {
                    type: Sequelize.TEXT
                },
                status: {
                    type: Sequelize.STRING,
                    defaultValue: 'backlog'
                },
                priority: {
                    type: Sequelize.STRING,
                    defaultValue: 'medium'
                },
                assigned_to: {
                    type: Sequelize.UUID,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onDelete: 'SET NULL'
                },
                created_by: {
                    type: Sequelize.UUID,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onDelete: 'SET NULL'
                },
                due_date: {
                    type: Sequelize.DATE
                },
                category: {
                    type: Sequelize.STRING
                },
                tags: {
                    type: Sequelize.ARRAY(Sequelize.STRING),
                    defaultValue: []
                },
                attachments: {
                    type: Sequelize.JSONB,
                    defaultValue: {}
                },
                comments: {
                    type: Sequelize.JSONB,
                    defaultValue: {}
                },
                time_estimate: {
                    type: Sequelize.INTEGER
                },
                time_spent: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0
                },
                archived: {
                    type: Sequelize.BOOLEAN,
                    defaultValue: false
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

        } catch (error) {
            console.error('Erro na migração:', error);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        // Dropar todas as tabelas na ordem correta
        await queryInterface.dropTable('user_progress');
        await queryInterface.dropTable('services');
        await queryInterface.dropTable('learning_modules');
        await queryInterface.dropTable('user_roles');
        await queryInterface.dropTable('roles');
        await queryInterface.dropTable('users');
    }
}; 