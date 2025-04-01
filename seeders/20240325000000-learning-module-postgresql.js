'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Verificar se o módulo já existe
        const existingModule = await queryInterface.sequelize.query(
            `SELECT id FROM learning_modules WHERE name = 'postgresql'`,
            { type: Sequelize.QueryTypes.SELECT }
        );

        if (existingModule.length === 0) {
            // Criar o módulo
            const [module] = await queryInterface.bulkInsert('learning_modules', [{
                id: Sequelize.literal('uuid_generate_v4()'),
                name: 'postgresql',
                description: 'Aprenda PostgreSQL do básico ao avançado',
                api_endpoint: '/api/learning/postgresql',
                created_at: new Date(),
                updated_at: new Date()
            }], { returning: true });

            // Criar uma página inicial
            await queryInterface.bulkInsert('learning_pages', [{
                id: Sequelize.literal('uuid_generate_v4()'),
                module_id: module.id,
                title: 'Introdução ao PostgreSQL',
                content: '# Bem-vindo ao módulo PostgreSQL\n\nAprenda os fundamentos e conceitos avançados do PostgreSQL.',
                order: 1,
                created_at: new Date(),
                updated_at: new Date()
            }]);
        }
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkDelete('learning_pages', null, {});
        await queryInterface.bulkDelete('learning_modules', {
            name: 'postgresql'
        }, {});
    }
}; 