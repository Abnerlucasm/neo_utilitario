'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            // Verificar se a tabela roles existe
            const tablesExist = await Promise.all([
                queryInterface.showAllTables()
                    .then(tables => tables.includes('roles')),
                queryInterface.showAllTables()
                    .then(tables => tables.includes('resources')),
                queryInterface.showAllTables()
                    .then(tables => tables.includes('role_resources'))
            ]);

            const [rolesExists, resourcesExists, roleResourcesExists] = tablesExist;

            if (!rolesExists) {
                // Criar tabela de roles
                await queryInterface.createTable('roles', {
                    id: {
                        type: Sequelize.UUID,
                        defaultValue: Sequelize.UUIDV4,
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
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
                    },
                    updated_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
                    }
                }, { transaction });
            }

            if (!resourcesExists) {
                // Criar tabela de resources
                await queryInterface.createTable('resources', {
                    id: {
                        type: Sequelize.UUID,
                        defaultValue: Sequelize.UUIDV4,
                        primaryKey: true
                    },
                    name: {
                        type: Sequelize.STRING,
                        allowNull: false,
                        unique: true
                    },
                    path: {
                        type: Sequelize.STRING,
                        allowNull: false,
                        unique: true
                    },
                    description: {
                        type: Sequelize.TEXT
                    },
                    icon: {
                        type: Sequelize.STRING,
                        defaultValue: 'fas fa-link'
                    },
                    is_active: {
                        type: Sequelize.BOOLEAN,
                        defaultValue: true
                    },
                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
                    },
                    updated_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
                    }
                }, { transaction });
            }

            if (!roleResourcesExists) {
                // Criar tabela de relacionamento role_resources
                await queryInterface.createTable('role_resources', {
                    role_id: {
                        type: Sequelize.UUID,
                        references: {
                            model: 'roles',
                            key: 'id'
                        },
                        onUpdate: 'CASCADE',
                        onDelete: 'CASCADE'
                    },
                    resource_id: {
                        type: Sequelize.UUID,
                        references: {
                            model: 'resources',
                            key: 'id'
                        },
                        onUpdate: 'CASCADE',
                        onDelete: 'CASCADE'
                    },
                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
                    },
                    updated_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
                    }
                }, { transaction });

                // Adicionar índice composto
                await queryInterface.addIndex('role_resources', ['role_id', 'resource_id'], {
                    unique: true,
                    transaction
                });
            }

            // Verificar se já existem recursos
            const existingResources = await queryInterface.sequelize.query(
                'SELECT name FROM resources',
                { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
            );
            const existingResourceNames = existingResources.map(r => r.name);

            // Inserir apenas recursos que não existem
            const defaultResources = require('../config/defaultResources');
            const newResources = defaultResources.filter(r => !existingResourceNames.includes(r.name));

            if (newResources.length > 0) {
                await queryInterface.bulkInsert('resources', 
                    newResources.map(resource => ({
                        id: Sequelize.literal('uuid_generate_v4()'),
                        ...resource,
                        created_at: new Date(),
                        updated_at: new Date()
                    })), 
                    { transaction }
                );
            }

            // Verificar se o papel admin já existe
            const adminExists = await queryInterface.sequelize.query(
                'SELECT id FROM roles WHERE name = ?',
                {
                    replacements: ['admin'],
                    type: queryInterface.sequelize.QueryTypes.SELECT,
                    transaction
                }
            );

            if (adminExists.length === 0) {
                await queryInterface.bulkInsert('roles', [{
                    id: Sequelize.literal('uuid_generate_v4()'),
                    name: 'admin',
                    description: 'Administrador do sistema',
                    created_at: new Date(),
                    updated_at: new Date()
                }], { transaction });
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            await queryInterface.dropTable('role_resources', { transaction });
            await queryInterface.dropTable('resources', { transaction });
            await queryInterface.dropTable('roles', { transaction });

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}; 