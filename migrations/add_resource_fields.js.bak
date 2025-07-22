const { DataTypes } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Migração para adicionar campos necessários à tabela resources
 */
async function addResourceFields(queryInterface, Sequelize) {
    try {
        logger.info('Iniciando migração para adicionar campos à tabela resources...');
        
        // Verificar se a tabela resources existe
        const tableExists = await queryInterface.showAllTables()
            .then(tables => tables.includes('resources'));
        
        if (!tableExists) {
            logger.info('Tabela resources não existe. Criando tabela completa...');
            
            await queryInterface.createTable('resources', {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true
                },
                name: {
                    type: DataTypes.STRING(100),
                    allowNull: false
                },
                path: {
                    type: DataTypes.STRING(255),
                    allowNull: false
                },
                description: {
                    type: DataTypes.TEXT,
                    allowNull: true
                },
                type: {
                    type: DataTypes.ENUM('MENU', 'PAGE', 'API', 'COMPONENT', 'REPORT', 'UTILITY', 'ADMIN', 'OTHER'),
                    allowNull: false,
                    defaultValue: 'PAGE'
                },
                icon: {
                    type: DataTypes.STRING(50),
                    allowNull: true
                },
                is_active: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: true
                },
                is_system: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false
                },
                is_admin_only: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false
                },
                parent_id: {
                    type: DataTypes.UUID,
                    allowNull: true,
                    references: {
                        model: 'resources',
                        key: 'id'
                    }
                },
                order: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 0
                },
                metadata: {
                    type: DataTypes.JSONB,
                    allowNull: true,
                    defaultValue: {}
                },
                created_at: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW
                },
                updated_at: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW
                }
            });
            
            // Criar índices
            await queryInterface.addIndex('resources', ['path'], {
                name: 'idx_resources_path'
            });
            
            await queryInterface.addIndex('resources', ['type'], {
                name: 'idx_resources_type'
            });
            
            await queryInterface.addIndex('resources', ['is_active'], {
                name: 'idx_resources_active'
            });
            
            await queryInterface.addIndex('resources', ['parent_id'], {
                name: 'idx_resources_parent'
            });
            
            logger.info('Tabela resources criada com sucesso!');
        } else {
            logger.info('Tabela resources existe. Verificando campos...');
            
            // Verificar se o campo order existe
            const orderExists = await queryInterface.describeTable('resources')
                .then(columns => columns.hasOwnProperty('order'));
            
            if (!orderExists) {
                logger.info('Adicionando campo order...');
                await queryInterface.addColumn('resources', 'order', {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 0
                });
            }
            
            // Verificar se o campo parent_id existe
            const parentIdExists = await queryInterface.describeTable('resources')
                .then(columns => columns.hasOwnProperty('parent_id'));
            
            if (!parentIdExists) {
                logger.info('Adicionando campo parent_id...');
                await queryInterface.addColumn('resources', 'parent_id', {
                    type: DataTypes.UUID,
                    allowNull: true,
                    references: {
                        model: 'resources',
                        key: 'id'
                    }
                });
                
                // Adicionar índice para parent_id
                await queryInterface.addIndex('resources', ['parent_id'], {
                    name: 'idx_resources_parent'
                });
            }
            
            // Verificar se o campo is_admin_only existe
            const isAdminOnlyExists = await queryInterface.describeTable('resources')
                .then(columns => columns.hasOwnProperty('is_admin_only'));
            
            if (!isAdminOnlyExists) {
                logger.info('Adicionando campo is_admin_only...');
                await queryInterface.addColumn('resources', 'is_admin_only', {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false
                });
            }
            
            // Verificar se o campo is_system existe
            const isSystemExists = await queryInterface.describeTable('resources')
                .then(columns => columns.hasOwnProperty('is_system'));
            
            if (!isSystemExists) {
                logger.info('Adicionando campo is_system...');
                await queryInterface.addColumn('resources', 'is_system', {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false
                });
            }
            
            // Verificar se o campo metadata existe
            const metadataExists = await queryInterface.describeTable('resources')
                .then(columns => columns.hasOwnProperty('metadata'));
            
            if (!metadataExists) {
                logger.info('Adicionando campo metadata...');
                await queryInterface.addColumn('resources', 'metadata', {
                    type: DataTypes.JSONB,
                    allowNull: true,
                    defaultValue: {}
                });
            }
            
            logger.info('Campos adicionados com sucesso!');
        }
        
        logger.info('Migração concluída com sucesso!');
        return true;
    } catch (error) {
        logger.error('Erro na migração:', error);
        throw error;
    }
}

module.exports = addResourceFields; 