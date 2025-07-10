const { sequelize } = require('../config/database');
const addResourceFields = require('../migrations/add_resource_fields');
const logger = require('../utils/logger');

async function runMigration() {
    try {
        logger.info('Iniciando execução da migração...');
        
        // Testar conexão
        await sequelize.authenticate();
        logger.info('Conexão com banco de dados estabelecida');
        
        // Executar migração
        await addResourceFields(sequelize.getQueryInterface(), sequelize);
        
        logger.info('Migração executada com sucesso!');
        process.exit(0);
    } catch (error) {
        logger.error('Erro ao executar migração:', error);
        process.exit(1);
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    runMigration();
}

module.exports = runMigration; 