require('dotenv').config();
const sequelize = require('../config/database');
const PostgresContent = require('../models/postgresql/Content');
const UserProgress = require('../models/postgresql/UserProgress');
const logger = require('../utils/logger');

// Conteúdo inicial para PostgreSQL
const initialContent = {
    type: 'learn-postgresql',
    content: {
        intro: {
            title: 'Introdução ao PostgreSQL',
            content: '# Bem-vindo ao Tutorial de PostgreSQL\n\nSelecione uma seção para começar.',
            components: [],
            tags: ['início']
        }
    },
    sections: [
        {
            id: 'getting-started',
            name: 'Primeiros Passos',
            pages: ['intro']
        }
    ]
};

async function syncDatabase() {
    try {
        // Sincronizar modelos
        // await sequelize.sync({ alter: true });
        logger.info('Modelos sincronizados com sucesso');

        // Inserir conteúdo inicial se não existir
        const [content, created] = await PostgresContent.findOrCreate({
            where: { type: 'learn-postgresql' },
            defaults: initialContent
        });

        if (created) {
            logger.info('Conteúdo inicial criado com sucesso');
        } else {
            logger.info('Conteúdo inicial já existe');
        }

        logger.info('Database sincronizado com sucesso!');
        process.exit(0);
    } catch (error) {
        logger.error('Erro ao sincronizar database:', error);
        process.exit(1);
    }
}

syncDatabase();