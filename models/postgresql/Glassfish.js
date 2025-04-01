'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class Glassfish extends Model {
        static associate(models) {
            // As associações serão definidas em associations.js
        }
    }

    Glassfish.init({
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
        host: {
            type: DataTypes.STRING,
            allowNull: false
        },
        port: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        domain: {
            type: DataTypes.STRING,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive', 'error'),
            defaultValue: 'inactive'
        },
        last_check: {
            type: DataTypes.DATE
        },
        config: {
            type: DataTypes.JSONB,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'Glassfish',
        tableName: 'glassfish_servers',
        underscored: true
    });

    return Glassfish;
}; 