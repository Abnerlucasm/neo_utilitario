'use strict';

const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const path = require('path');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        dialect: 'postgres',
        logging: false,
        define: {
            underscored: true,
            timestamps: true
        }
    }
);

const umzug = new Umzug({
    migrations: { 
        glob: 'migrations/*.js',
        resolve: ({ name, path, context }) => {
            const migration = require(path);
            return {
                name,
                up: async () => migration.up(context.queryInterface, context.sequelize),
                down: async () => migration.down(context.queryInterface, context.sequelize)
            };
        }
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console
});

async function runMigrations() {
    try {
        console.log('Iniciando migrações...');
        
        // Verificar conexão com o banco
        await sequelize.authenticate();
        console.log('Conexão com o banco de dados estabelecida com sucesso.');
        
        // Executar migrações pendentes
        const migrations = await umzug.up();
        
        if (migrations.length === 0) {
            console.log('Nenhuma migração pendente encontrada.');
        } else {
            console.log(`Executadas ${migrations.length} migrações:`);
            migrations.forEach(migration => {
                console.log(`- ${migration.name}`);
            });
        }
        
        console.log('Migrações concluídas com sucesso!');
        
        // Fechar conexão
        await sequelize.close();
    } catch (error) {
        console.error('Erro ao executar migrações:', error);
        process.exit(1);
    }
}

// Executar migrações
runMigrations(); 