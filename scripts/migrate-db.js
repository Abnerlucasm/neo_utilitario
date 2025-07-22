require('dotenv').config();
const sequelize = require('../config/database');
const PostgresContent = require('../models/postgresql/Content');
const logger = require('../utils/logger');
const LearningModule = require('../models/postgresql/LearningModule');
const Component = require('../models/postgresql/Component');

const initialContent = {
    type: 'learn-postgresql',
    content: {
        'page-1': {
            title: 'Introdução ao PostgreSQL',
            content: '# Bem-vindo ao Tutorial PostgreSQL\n\nEste é o conteúdo inicial.',
            components: []
        }
    },
    sections: [{
        id: 'section-1',
        title: 'Introdução',
        pages: ['page-1']
    }]
};

async function migrate() {
    try {
        // Sincronizar tabelas
        // await sequelize.sync({ alter: true });
        logger.info('Tabelas sincronizadas com sucesso');

        // Criar módulo PostgreSQL inicial se não existir
        const [module, created] = await LearningModule.findOrCreate({
            where: { id: 'postgresql' },
            defaults: {
                title: 'PostgreSQL',
                description: 'Aprenda PostgreSQL do básico ao avançado',
                route: '/learn-postgresql',
                apiEndpoint: '/api/learn-postgresql/content',
                content: {},
                sections: []
            }
        });

        if (created) {
            logger.info('Módulo inicial criado com sucesso');
        } else {
            logger.info('Módulo inicial já existe');
        }

        logger.info('Migração concluída com sucesso');
        process.exit(0);
    } catch (error) {
        logger.error('Erro na migração:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    migrate();
}

module.exports = migrate; 