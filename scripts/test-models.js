'use strict';

const { sequelize } = require('../config/database');
const models = require('../models/postgresql/associations');

async function testModels() {
    try {
        console.log('Iniciando teste de modelos...');
        
        // Testar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com o banco de dados estabelecida com sucesso.');
        
        // Verificar modelos
        const modelNames = Object.keys(models).filter(key => 
            key !== 'sequelize' && key !== 'initAssociations');
        
        console.log(`\nModelos disponíveis (${modelNames.length}):`);
        modelNames.forEach(name => {
            console.log(`- ${name}`);
        });
        
        // Inicializar associações
        models.initAssociations();
        console.log('\n✅ Associações inicializadas com sucesso.');
        
        // Verificar tabelas existentes no banco de dados
        const tables = await sequelize.getQueryInterface().showAllTables();
        console.log(`\nTabelas no banco de dados (${tables.length}):`);
        tables.forEach(table => {
            console.log(`- ${table}`);
        });
        
        // Fechar conexão
        await sequelize.close();
        console.log('\n✅ Teste concluído com sucesso!');
    } catch (error) {
        console.error('\n❌ Erro ao testar modelos:', error);
        process.exit(1);
    }
}

// Executar teste
testModels(); 