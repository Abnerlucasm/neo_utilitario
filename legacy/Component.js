'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class Component extends Model {
        static associate(models) {
            // As associações serão definidas em associations.js
        }
    }

    Component.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        category: {
            type: DataTypes.STRING,
            allowNull: true
        },
        content: {
            type: DataTypes.JSONB,
            defaultValue: {}
        },
        html: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        css: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        js: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        created_by: {
            type: DataTypes.UUID,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        sequelize,
        modelName: 'Component',
        tableName: 'components',
        underscored: true
    });

    return Component;
}; 