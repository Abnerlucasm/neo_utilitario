'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class Resource extends Model {
        static associate(models) {
            // As associações serão definidas em associations.js
        }
    }

    Resource.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        description: {
            type: DataTypes.TEXT
        },
        path: {
            type: DataTypes.STRING,
            allowNull: false
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        icon: {
            type: DataTypes.STRING,
            defaultValue: 'fas fa-link'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        sequelize,
        modelName: 'Resource',
        tableName: 'resources',
        underscored: true
    });

    return Resource;
}; 