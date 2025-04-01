'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserProgress = sequelize.define('UserProgress', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
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
        type: DataTypes.JSONB,
        defaultValue: {}
    },
    completed_pages: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
    },
    last_accessed_page: {
        type: DataTypes.STRING
    }
}, {
    tableName: 'user_progress',
    underscored: true,
    timestamps: true
});

module.exports = UserProgress; 