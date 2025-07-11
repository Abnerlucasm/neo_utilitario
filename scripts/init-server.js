/**
 * Script de inicialização do servidor
 * Este script executa verificações iniciais antes de iniciar o servidor
 */
const logger = require('../utils/logger');

async function initServer() {
    try {
        logger.info('Iniciando verificações do servidor...');
        
        // Verificações básicas do servidor
        logger.info('Verificando configurações básicas...');
        
        // Verificar se as variáveis de ambiente essenciais estão definidas
        const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'JWT_SECRET'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            logger.warn('Variáveis de ambiente faltando:', missingVars);
        } else {
            logger.info('Todas as variáveis de ambiente essenciais estão configuradas');
        }
        
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