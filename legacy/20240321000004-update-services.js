'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tables = await queryInterface.showAllTables();
        const tableInfo = tables.includes('services') ? await queryInterface.describeTable('services') : {};

        // Verificar se o tipo UUID existe
        await queryInterface.sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'uuid') THEN
                    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
                END IF;
            END
            $$;
        `);

        // Se a tabela não existir, criar do zero
        if (!tables.includes('services')) {
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
                due_date: {
                    type: Sequelize.DATE
                },
                assigned_to: {
                    type: Sequelize.UUID,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                created_by: {
                    type: Sequelize.UUID,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
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
            return;
        }

        // Se a tabela existir, verificar e adicionar colunas faltantes
        const columns = {
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
            }
        };

        // Adicionar colunas faltantes
        for (const [columnName, columnDef] of Object.entries(columns)) {
            if (!tableInfo[columnName]) {
                await queryInterface.addColumn('services', columnName, columnDef);
            }
        }

        // Verificar e atualizar tipos de colunas existentes se necessário
        if (tableInfo.assigned_to && tableInfo.assigned_to.type !== 'UUID') {
            await queryInterface.changeColumn('services', 'assigned_to', {
                type: Sequelize.UUID,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            });
        }

        if (tableInfo.created_by && tableInfo.created_by.type !== 'UUID') {
            await queryInterface.changeColumn('services', 'created_by', {
                type: Sequelize.UUID,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            });
        }
    },

    down: async (queryInterface, Sequelize) => {
        // Não vamos dropar a tabela no down para manter os dados
    }
}; 