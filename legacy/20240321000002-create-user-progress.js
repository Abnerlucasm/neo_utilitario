'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Verificar se a tabela já existe
        const tables = await queryInterface.showAllTables();
        if (!tables.includes('user_progress')) {
            await queryInterface.createTable('user_progress', {
                id: {
                    type: Sequelize.UUID,
                    defaultValue: Sequelize.UUIDV4,
                    primaryKey: true
                },
                user_id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE'
                },
                module_id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: {
                        model: 'learning_modules',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE'
                },
                content_type: {
                    type: Sequelize.STRING,
                    allowNull: true
                },
                completed_pages: {
                    type: Sequelize.ARRAY(Sequelize.STRING),
                    defaultValue: []
                },
                total_pages: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0
                },
                status: {
                    type: Sequelize.STRING,
                    defaultValue: 'not_started'
                },
                progress_value: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0
                },
                progress: {
                    type: Sequelize.JSONB,
                    defaultValue: {}
                },
                completed_lessons: {
                    type: Sequelize.ARRAY(Sequelize.STRING),
                    defaultValue: []
                },
                last_accessed: {
                    type: Sequelize.DATE
                },
                time_spent: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0
                },
                score: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0
                },
                notes: {
                    type: Sequelize.TEXT
                },
                certificates: {
                    type: Sequelize.JSONB,
                    defaultValue: {}
                },
                achievements: {
                    type: Sequelize.JSONB,
                    defaultValue: {}
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

            // Adicionar índices
            try {
                await queryInterface.addIndex('user_progress', ['user_id', 'module_id'], {
                    unique: true,
                    name: 'user_progress_user_id_module_id'
                });

                await queryInterface.addIndex('user_progress', ['content_type'], {
                    name: 'user_progress_content_type_idx'
                });
            } catch (error) {
                // Se os índices já existirem, ignorar o erro
                if (!error.message.includes('already exists')) {
                    throw error;
                }
            }
        }
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('user_progress');
    }
}; 