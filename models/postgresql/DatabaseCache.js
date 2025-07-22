'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const DatabaseCache = sequelize.define('DatabaseCache', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        serverId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'servers',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        serverName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        serverHost: {
            type: DataTypes.STRING,
            allowNull: false
        },
        databases: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: []
        },
        lastUpdated: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        status: {
            type: DataTypes.ENUM('success', 'error', 'pending'),
            allowNull: false,
            defaultValue: 'pending'
        },
        errorMessage: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        totalDatabases: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        cacheVersion: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        }
    }, {
        sequelize,
        modelName: 'DatabaseCache',
        tableName: 'database_cache',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                name: 'idx_database_cache_server_id',
                fields: ['server_id']
            },
            {
                name: 'idx_database_cache_last_updated',
                fields: ['last_updated']
            },
            {
                name: 'idx_database_cache_status',
                fields: ['status']
            }
        ]
    });

    return DatabaseCache;
}; 