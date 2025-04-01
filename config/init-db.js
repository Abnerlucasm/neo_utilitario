'use strict';

const { sequelize } = require('./database');
const { initAssociations } = require('../models/postgresql/associations');
const logger = require('../utils/logger');

async function initializeDatabase() {
    try {
        // Testar conexão
        await sequelize.authenticate();
        logger.info('Conexão com o banco de dados estabelecida com sucesso.');

        // Inicializar associações
        initAssociations();
        logger.info('Associações dos modelos inicializadas com sucesso.');

        // Sincronizar modelos com o banco
        await sequelize.sync();
        logger.info('Modelos sincronizados com o banco de dados.');

        return true;
    } catch (error) {
        logger.error('Erro ao inicializar banco de dados:', error);
        throw error;
    }
}

module.exports = initializeDatabase; 