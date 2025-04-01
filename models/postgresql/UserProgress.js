'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class UserProgress extends Model {
        static associate(models) {
            // As associações serão definidas em associations.js
        }
    }

    UserProgress.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        module_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'learning_modules',
                key: 'id'
            }
        },
        progress: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            validate: {
                min: 0,
                max: 100
            }
        },
        completed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        completed_pages: {
            type: DataTypes.JSONB,
            defaultValue: []
        },
        total_pages: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        last_accessed: {
            type: DataTypes.DATE
        },
        completion_date: {
            type: DataTypes.DATE
        },
        notes: {
            type: DataTypes.TEXT
        }
    }, {
        sequelize,
        modelName: 'UserProgress',
        tableName: 'user_progress',
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['user_id', 'module_id']
            }
        ]
    });

    return UserProgress;
}; 