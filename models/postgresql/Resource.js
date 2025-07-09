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
                where: { parent_id: this.id },
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
         * Retorna uma representação do recurso para API
         * @returns {Object} Representação JSON do recurso
         */
        toJSON() {
            const values = Object.assign({}, this.get());
            
            // Remove campos sensíveis ou desnecessários se houver
            return values;
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
            type: DataTypes.ENUM('PAGE', 'API', 'COMPONENT', 'REPORT', 'OTHER'),
            allowNull: false,
            defaultValue: 'PAGE',
            validate: {
                isIn: {
                    args: [['PAGE', 'API', 'COMPONENT', 'REPORT', 'OTHER']],
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
        }
    }, {
        sequelize,
        modelName: 'Resource',
        tableName: 'resources',
        timestamps: true,
        underscored: true
    });

    return Resource;
}; 