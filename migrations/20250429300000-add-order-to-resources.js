'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    try {
      // Verificar se a tabela resources existe
      const resourcesExists = await queryInterface.showAllTables()
        .then(tables => tables.includes('resources'));
      
      if (resourcesExists) {
        // Verificar se a coluna order já existe
        const [columns] = await queryInterface.sequelize.query(`
          SELECT column_name
          FROM information_schema.columns 
          WHERE table_name = 'resources' AND column_name = 'order'
        `);
        
        // Se a coluna não existir, adicioná-la
        if (columns.length === 0) {
          console.log('Adicionando coluna order à tabela resources');
          
          await queryInterface.addColumn('resources', 'order', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
          });
          
          console.log('Coluna order adicionada com sucesso');
        } else {
          console.log('A coluna order já existe na tabela resources');
        }
      } else {
        console.log('A tabela resources não existe, não é possível adicionar a coluna');
      }
    } catch (error) {
      console.error('Erro durante a migração:', error);
    }
  },

  async down (queryInterface, Sequelize) {
    try {
      // Verificar se a tabela resources existe
      const resourcesExists = await queryInterface.showAllTables()
        .then(tables => tables.includes('resources'));
      
      if (resourcesExists) {
        // Verificar se a coluna order existe
        const [columns] = await queryInterface.sequelize.query(`
          SELECT column_name
          FROM information_schema.columns 
          WHERE table_name = 'resources' AND column_name = 'order'
        `);
        
        // Se a coluna existir, removê-la
        if (columns.length > 0) {
          console.log('Removendo coluna order da tabela resources');
          
          await queryInterface.removeColumn('resources', 'order');
          
          console.log('Coluna order removida com sucesso');
        } else {
          console.log('A coluna order não existe na tabela resources');
        }
      } else {
        console.log('A tabela resources não existe, não é possível remover a coluna');
      }
    } catch (error) {
      console.error('Erro ao reverter migração:', error);
    }
  }
}; 