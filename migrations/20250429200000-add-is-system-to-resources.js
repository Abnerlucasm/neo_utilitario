'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    try {
      // Verificar se a tabela resources existe
      const resourcesExists = await queryInterface.showAllTables()
        .then(tables => tables.includes('resources'));
      
      if (resourcesExists) {
        // Verificar se a coluna is_system já existe
        const [columns] = await queryInterface.sequelize.query(`
          SELECT column_name
          FROM information_schema.columns 
          WHERE table_name = 'resources' AND column_name = 'is_system'
        `);
        
        // Se a coluna não existir, adicioná-la
        if (columns.length === 0) {
          console.log('Adicionando coluna is_system à tabela resources');
          
          await queryInterface.addColumn('resources', 'is_system', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
          });
          
          console.log('Coluna is_system adicionada com sucesso');
        } else {
          console.log('A coluna is_system já existe na tabela resources');
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
        // Verificar se a coluna is_system existe
        const [columns] = await queryInterface.sequelize.query(`
          SELECT column_name
          FROM information_schema.columns 
          WHERE table_name = 'resources' AND column_name = 'is_system'
        `);
        
        // Se a coluna existir, removê-la
        if (columns.length > 0) {
          console.log('Removendo coluna is_system da tabela resources');
          
          await queryInterface.removeColumn('resources', 'is_system');
          
          console.log('Coluna is_system removida com sucesso');
        } else {
          console.log('A coluna is_system não existe na tabela resources');
        }
      } else {
        console.log('A tabela resources não existe, não é possível remover a coluna');
      }
    } catch (error) {
      console.error('Erro ao reverter migração:', error);
    }
  }
}; 