'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class Session extends Model {
        static associate(models) {
            // As associações serão definidas em associations.js
        }
    }

    Session.init({
        sid: {
            type: DataTypes.STRING,
            primaryKey: true
        },
        user_id: {
            type: DataTypes.UUID,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        expires: DataTypes.DATE,
        data: DataTypes.TEXT
    }, {
        sequelize,
        modelName: 'Session',
        tableName: 'sessions',
        underscored: true
    });

    return Session;
}; 