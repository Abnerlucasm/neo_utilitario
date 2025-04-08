'use strict';

const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');
require('dotenv').config();

// Configuração do PostgreSQL
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        dialect: 'postgres',
        logging: (msg) => {
            // Adicionar logs apenas quando necessário
            if (msg.includes('ERROR') || msg.includes('error') || msg.includes('Executing')) {
                logger.debug(msg);
            }
        },
        define: {
            underscored: true,
            timestamps: true
        },
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        // Adicionar opções para diagnóstico
        benchmark: true, // Para medir o tempo de execução das queries
        retry: {  // Tentar novamente se ocorrer um erro de conexão
            max: 3,
            match: [
                /SequelizeConnectionError/,
                /SequelizeConnectionRefusedError/,
                /SequelizeHostNotFoundError/,
                /SequelizeHostNotReachableError/,
                /SequelizeInvalidConnectionError/,
                /SequelizeConnectionTimedOutError/,
                /TimeoutError/
            ]
        }
    }
);

// Função para testar a conexão
async function testConnection() {
    try {
        await sequelize.authenticate();
        logger.info('Conexão com o banco de dados PostgreSQL estabelecida com sucesso.');
        return true;
    } catch (error) {
        logger.error('Erro ao conectar com o banco de dados PostgreSQL:', error);
        return false;
    }
}

// Sincronizar modelos com o banco
async function syncModels(force = false) {
    try {
        await sequelize.sync({ force });
        logger.info('Modelos sincronizados com o banco de dados PostgreSQL');
    } catch (error) {
        logger.error('Erro ao sincronizar modelos com PostgreSQL:', error);
        throw error;
    }
}

async function initDatabase() {
    try {
        await sequelize.authenticate();
        // Força a sincronização do modelo com o banco
        await sequelize.sync({ alter: true });
        logger.info('Banco de dados PostgreSQL sincronizado com sucesso');
    } catch (error) {
        logger.error('Erro ao sincronizar banco de dados PostgreSQL:', error);
        throw error;
    }
}

module.exports = {
    sequelize,
    testConnection,
    syncModels,
    initDatabase
}; 