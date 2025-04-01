'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class Permission extends Model {
        static associate(models) {
            // As associações serão definidas em associations.js
        }
    }

    Permission.init({
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
        resource: {
            type: DataTypes.STRING,
            allowNull: false
        },
        action: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        sequelize,
        modelName: 'Permission',
        tableName: 'permissions',
        underscored: true
    });

    return Permission;
}; 