/**
 * Script de inicialização do servidor
 * Este script executa verificações iniciais antes de iniciar o servidor
 */
const logger = require('../utils/logger');
const checkMenusTable = require('./check-menus-table');

async function initServer() {
    try {
        logger.info('Iniciando verificações do servidor...');
        
        // Verificar e reparar a tabela de menus
        logger.info('Verificando tabela de menus...');
        await checkMenusTable();
        
        logger.info('Verificações concluídas com sucesso! O servidor está pronto para iniciar.');
        return true;
    } catch (error) {
        logger.error('Erro durante a inicialização do servidor:', error);
        throw error;
    }
}

// Executar o script se for chamado diretamente
if (require.main === module) {
    (async () => {
        try {
            await initServer();
            process.exit(0);
        } catch (error) {
            console.error('Erro durante a inicialização:', error);
            process.exit(1);
        }
    })();
}

module.exports = initServer; 