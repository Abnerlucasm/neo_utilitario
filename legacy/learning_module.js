'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LearningModule = sequelize.define('LearningModule', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT
    },
    api_endpoint: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'learning_modules',
    underscored: true,
    timestamps: true
});

module.exports = LearningModule; 