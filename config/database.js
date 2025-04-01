'use strict';

const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        dialect: 'postgres',
        logging: msg => logger.debug(msg),
        define: {
            underscored: true,
            timestamps: true
        },
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

// Função para testar a conexão
async function testConnection() {
    try {
        await sequelize.authenticate();
        logger.info('Conexão com o banco de dados estabelecida com sucesso.');
        return true;
    } catch (error) {
        logger.error('Erro ao conectar com o banco de dados:', error);
        return false;
    }
}

// Sincronizar modelos com o banco
async function syncModels(force = false) {
    try {
        await sequelize.sync({ force });
        console.log('Modelos sincronizados com o banco de dados');
    } catch (error) {
        console.error('Erro ao sincronizar modelos:', error);
        throw error;
    }
}

async function initDatabase() {
    try {
        await sequelize.authenticate();
        // Força a sincronização do modelo com o banco
        await sequelize.sync({ alter: true });
        logger.info('Banco de dados sincronizado com sucesso');
    } catch (error) {
        logger.error('Erro ao sincronizar banco de dados:', error);
        throw error;
    }
}

module.exports = {
    sequelize,
    testConnection,
    syncModels,
    initDatabase
}; 