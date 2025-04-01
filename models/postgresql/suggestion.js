'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class Suggestion extends Model {
        static associate(models) {
            // As associações serão definidas em associations.js
        }
    }

    Suggestion.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected'),
            defaultValue: 'pending'
        },
        created_by: {
            type: DataTypes.UUID,
            references: {
                model: 'users',
                key: 'id'
            }
        }
    }, {
        sequelize,
        modelName: 'Suggestion',
        tableName: 'suggestions',
        underscored: true
    });

    return Suggestion;
}; 