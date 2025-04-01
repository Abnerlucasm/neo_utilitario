'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class LearningModule extends Model {
        static associate(models) {
            this.belongsTo(models.User, {
                foreignKey: 'created_by',
                as: 'creator'
            });
            this.hasMany(models.UserProgress, {
                foreignKey: 'module_id',
                as: 'progress'
            });
        }
    }

    LearningModule.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            get() {
                return this.getDataValue('title');
            },
            set(value) {
                this.setDataValue('title', value);
            }
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        route: {
            type: DataTypes.STRING,
            allowNull: true
        },
        imageUrl: {
            type: DataTypes.STRING,
            allowNull: true
        },
        api_endpoint: {
            type: DataTypes.STRING,
            allowNull: true
        },
        created_by: {
            type: DataTypes.UUID,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.ENUM('draft', 'published', 'archived'),
            defaultValue: 'draft'
        },
        content: {
            type: DataTypes.JSONB,
            defaultValue: {},
            get() {
                const rawValue = this.getDataValue('content');
                if (rawValue === null || rawValue === undefined) return {};
                return typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
            },
            set(value) {
                // Garantir que o valor é um objeto válido
                if (value === null || value === undefined) {
                    this.setDataValue('content', {});
                } else if (typeof value === 'string') {
                    try {
                        this.setDataValue('content', JSON.parse(value));
                    } catch (e) {
                        this.setDataValue('content', {});
                    }
                } else {
                    this.setDataValue('content', value);
                }
            }
        },
        sections: {
            type: DataTypes.JSONB,
            defaultValue: [],
            get() {
                const rawValue = this.getDataValue('sections');
                if (rawValue === null || rawValue === undefined) return [];
                return typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
            },
            set(value) {
                // Garantir que o valor é um array válido
                if (value === null || value === undefined) {
                    this.setDataValue('sections', []);
                } else if (typeof value === 'string') {
                    try {
                        this.setDataValue('sections', JSON.parse(value));
                    } catch (e) {
                        this.setDataValue('sections', []);
                    }
                } else {
                    this.setDataValue('sections', value);
                }
            }
        },
        keywords: {
            type: DataTypes.JSONB,
            defaultValue: '[]',
            get() {
                const rawValue = this.getDataValue('keywords');
                if (rawValue === null || rawValue === undefined) return [];
                if (typeof rawValue === 'string') {
                    try {
                        return JSON.parse(rawValue);
                    } catch (e) {
                        return [];
                    }
                }
                return rawValue;
            },
            set(value) {
                // Garantir que o valor é um array válido
                if (value === null || value === undefined) {
                    this.setDataValue('keywords', []);
                } else if (typeof value === 'string') {
                    try {
                        this.setDataValue('keywords', JSON.parse(value));
                    } catch (e) {
                        this.setDataValue('keywords', []);
                    }
                } else if (Array.isArray(value)) {
                    this.setDataValue('keywords', value);
                } else {
                    // Se não for array, tentar converter
                    try {
                        this.setDataValue('keywords', Array.isArray(value) ? value : []);
                    } catch (e) {
                        this.setDataValue('keywords', []);
                    }
                }
            },
            comment: 'Array de palavras-chave para facilitar a busca'
        },
        order: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        sequelize,
        modelName: 'LearningModule',
        tableName: 'learning_modules',
        underscored: true
    });

    return LearningModule;
}; 