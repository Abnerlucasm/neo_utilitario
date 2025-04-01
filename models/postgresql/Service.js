'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class Service extends Model {
        static associate(models) {
            // As associações serão definidas em associations.js
        }
    }

    Service.init({
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
            type: DataTypes.TEXT
        },
        status: {
            type: DataTypes.ENUM('backlog', 'todo', 'in_progress', 'review', 'done'),
            defaultValue: 'backlog'
        },
        priority: {
            type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
            defaultValue: 'medium'
        },
        assigned_to: {
            type: DataTypes.UUID,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        created_by: {
            type: DataTypes.UUID,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        due_date: {
            type: DataTypes.DATE
        },
        category: {
            type: DataTypes.STRING
        },
        tags: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            defaultValue: []
        },
        attachments: {
            type: DataTypes.JSONB,
            defaultValue: {}
        },
        comments: {
            type: DataTypes.JSONB,
            defaultValue: {}
        },
        time_estimate: {
            type: DataTypes.INTEGER
        },
        time_spent: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        archived: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        sequelize,
        modelName: 'Service',
        tableName: 'services',
        underscored: true,
        indexes: [
            {
                fields: ['status']
            },
            {
                fields: ['priority']
            },
            {
                fields: ['assigned_to']
            },
            {
                fields: ['created_by']
            }
        ]
    });

    return Service;
}; 