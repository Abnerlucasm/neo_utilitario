'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Primeiro, inserir o módulo e capturar o ID gerado
    const moduleId = await queryInterface.bulkInsert('learning_modules', [{
      id: Sequelize.literal('uuid_generate_v4()'),
      name: 'PostgreSQL',
      description: 'Aprenda PostgreSQL do básico ao avançado',
      api_endpoint: '/api/learning/postgresql',
      created_at: new Date(),
      updated_at: new Date()
    }], { returning: true });

    // Usar o ID do módulo para criar a página
    await queryInterface.bulkInsert('learning_pages', [{
      id: Sequelize.literal('uuid_generate_v4()'),
      module_id: moduleId[0].id,  // Usar o ID retornado do insert do módulo
      title: 'Introdução ao PostgreSQL',
      content: '# Introdução ao PostgreSQL\n\nBem-vindo ao módulo de PostgreSQL...',
      order: 1,
      created_at: new Date(),
      updated_at: new Date()
    }], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('learning_pages', null, {});
    await queryInterface.bulkDelete('learning_modules', null, {});
  }
}; 