'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class Resource extends Model {
        static associate(models) {
            // Associações
            this.belongsTo(models.Resource, { 
                foreignKey: 'parent_id', 
                as: 'parent',
                onDelete: 'SET NULL'
            });
            
            this.hasMany(models.Resource, { 
                foreignKey: 'parent_id', 
                as: 'children',
                onDelete: 'CASCADE' 
            });

            // Muitos para muitos com Role (permissões)
            this.belongsToMany(models.Role, { 
                through: 'role_resources',
                foreignKey: 'resource_id',
                otherKey: 'role_id',
                as: 'roles'
            });

            // Associação com Menu (para recursos que são menus)
            this.hasOne(models.Menu, {
                foreignKey: 'resource_id',
                as: 'menu'
            });
        }

        /**
         * Adiciona um recurso filho a este recurso
         * @param {Resource} childResource - O recurso filho a ser adicionado
         * @returns {Promise} 
         */
        async addChild(childResource) {
            childResource.parent_id = this.id;
            return await childResource.save();
        }

        /**
         * Obtém a árvore completa de recursos filhos
         * @returns {Promise<Array>} Lista de recursos filhos em formato de árvore
         */
        async getResourceTree() {
            const children = await Resource.findAll({ 
                where: { parent_id: this.id, is_active: true },
                order: [['order', 'ASC'], ['name', 'ASC']]
            });

            const result = [];
            
            for (const child of children) {
                const childData = child.toJSON();
                childData.children = await child.getResourceTree();
                result.push(childData);
            }
            
            return result;
        }

        /**
         * Verifica se o recurso tem permissão para um papel específico
         * @param {string} roleId - ID do papel
         * @returns {Promise<boolean>} True se tem permissão
         */
        async hasRole(roleId) {
            const role = await this.getRoles({ where: { id: roleId } });
            return role.length > 0;
        }

        /**
         * Obtém todos os papéis que têm acesso a este recurso
         * @returns {Promise<Array>} Lista de papéis
         */
        async getAccessibleRoles() {
            return await this.getRoles({
                attributes: ['id', 'name', 'description'],
                where: { is_active: true }
            });
        }

        /**
         * Retorna uma representação do recurso para API
         * @returns {Object} Representação JSON do recurso
         */
        toJSON() {
            const values = Object.assign({}, this.get());
            
            // Adicionar informações calculadas
            values.isAccessible = this.is_active;
            values.fullPath = this.getFullPath();
            
            return values;
        }

        /**
         * Obtém o caminho completo do recurso (incluindo pais)
         * @returns {string} Caminho completo
         */
        getFullPath() {
            if (!this.parent) {
                return this.path;
            }
            return `${this.parent.getFullPath()}/${this.path}`.replace(/\/+/g, '/');
        }

        /**
         * Verifica se o recurso é um menu
         * @returns {boolean} True se for um menu
         */
        isMenu() {
            return this.type === 'MENU' || this.type === 'PAGE';
        }

        /**
         * Verifica se o recurso é uma API
         * @returns {boolean} True se for uma API
         */
        isAPI() {
            return this.type === 'API';
        }

        /**
         * Obtém o ícone do recurso com fallback
         * @returns {string} Classe do ícone
         */
        getIcon() {
            return this.icon || this.getDefaultIcon();
        }

        /**
         * Obtém o ícone padrão baseado no tipo
         * @returns {string} Classe do ícone padrão
         */
        getDefaultIcon() {
            const defaultIcons = {
                'MENU': 'fas fa-bars',
                'PAGE': 'fas fa-file-alt',
                'API': 'fas fa-code',
                'COMPONENT': 'fas fa-puzzle-piece',
                'REPORT': 'fas fa-chart-bar',
                'UTILITY': 'fas fa-tools',
                'ADMIN': 'fas fa-cog',
                'OTHER': 'fas fa-link'
            };
            return defaultIcons[this.type] || 'fas fa-link';
        }
    }

    Resource.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            validate: {
                notNull: { msg: 'O nome do recurso é obrigatório' },
                notEmpty: { msg: 'O nome do recurso não pode ser vazio' },
                len: {
                    args: [2, 100],
                    msg: 'O nome do recurso deve ter entre 2 e 100 caracteres'
                }
            }
        },
        path: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                notNull: { msg: 'O caminho do recurso é obrigatório' },
                notEmpty: { msg: 'O caminho do recurso não pode ser vazio' }
            }
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        type: {
            type: DataTypes.ENUM('MENU', 'PAGE', 'API', 'COMPONENT', 'REPORT', 'UTILITY', 'ADMIN', 'OTHER'),
            allowNull: false,
            defaultValue: 'PAGE',
            validate: {
                isIn: {
                    args: [['MENU', 'PAGE', 'API', 'COMPONENT', 'REPORT', 'UTILITY', 'ADMIN', 'OTHER']],
                    msg: 'Tipo de recurso inválido'
                }
            }
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
        }
    }, {
        sequelize,
        modelName: 'Resource',
        tableName: 'resources',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                name: 'idx_resources_path',
                fields: ['path']
            },
            {
                name: 'idx_resources_type',
                fields: ['type']
            },
            {
                name: 'idx_resources_active',
                fields: ['is_active']
            },
            {
                name: 'idx_resources_parent',
                fields: ['parent_id']
            }
        ]
    });

    return Resource;
}; 