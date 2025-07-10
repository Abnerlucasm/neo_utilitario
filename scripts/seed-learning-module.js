/**
 * Script para criar um módulo de exemplo para testes
 */
const { sequelize, LearningModule } = require('../models/postgresql');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

async function createExampleModule() {
    try {
        logger.info('Criando módulo de exemplo para testes...');
        
        // Verificar se já existe algum módulo
        const existingModulesCount = await LearningModule.count();
        
        if (existingModulesCount > 0) {
            logger.info(`Já existem ${existingModulesCount} módulos no banco de dados.`);
            logger.info('Pulando criação do módulo de exemplo.');
            return;
        }
        
        // Criar módulo de exemplo
        const moduleId = uuidv4();
        
        const moduleData = {
            id: moduleId,
            title: 'Módulo de Exemplo para Testes',
            description: 'Este é um módulo de exemplo para testar a exibição na Central de Aprendizado.',
            status: 'published',
            route: `/learn/${moduleId}`,
            apiEndpoint: `/api/learning/${moduleId}/content`,
            imageUrl: '/assets/default-module.jpg',
            keywords: ['exemplo', 'teste', 'demonstração'],
            sections: [
                {
                    id: uuidv4(),
                    title: 'Seção 1 - Introdução',
                    pages: [
                        'page1', 'page2'
                    ]
                },
                {
                    id: uuidv4(),
                    title: 'Seção 2 - Conteúdo',
                    pages: [
                        'page3', 'page4'
                    ]
                }
            ],
            content: {
                'page1': {
                    id: 'page1',
                    title: 'Página 1 - Boas-vindas',
                    content: '<h1>Bem-vindo ao módulo de exemplo</h1><p>Esta é uma página de exemplo para mostrar como os módulos funcionam.</p>'
                },
                'page2': {
                    id: 'page2',
                    title: 'Página 2 - Sobre',
                    content: '<h1>Sobre este módulo</h1><p>Este módulo foi criado para testes da Central de Aprendizado.</p>'
                },
                'page3': {
                    id: 'page3',
                    title: 'Página 3 - Conteúdo',
                    content: '<h1>Conteúdo principal</h1><p>Aqui estaria o conteúdo principal do módulo.</p>'
                },
                'page4': {
                    id: 'page4',
                    title: 'Página 4 - Conclusão',
                    content: '<h1>Conclusão</h1><p>Esta é a página final do nosso módulo de exemplo.</p>'
                }
            }
        };
        
        // Criar módulo no banco de dados
        await LearningModule.create(moduleData);
        
        logger.info('Módulo de exemplo criado com sucesso!');
        return true;
    } catch (error) {
        logger.error('Erro ao criar módulo de exemplo:', error);
        throw error;
    }
}

// Executar o script se for chamado diretamente
if (require.main === module) {
    (async () => {
        try {
            await sequelize.authenticate();
            logger.info('Conexão com o banco de dados estabelecida com sucesso');
            await createExampleModule();
            process.exit(0);
        } catch (error) {
            console.error('Erro ao executar script:', error);
            process.exit(1);
        }
    })();
}

module.exports = createExampleModule; 