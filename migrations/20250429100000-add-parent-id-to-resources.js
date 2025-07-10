'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    try {
      // Verificar se a tabela resources existe
      const resourcesExists = await queryInterface.showAllTables()
        .then(tables => tables.includes('resources'));
      
      if (resourcesExists) {
        // Verificar se a coluna parent_id já existe
        const [columns] = await queryInterface.sequelize.query(`
          SELECT column_name
          FROM information_schema.columns 
          WHERE table_name = 'resources' AND column_name = 'parent_id'
        `);
        
        // Se a coluna não existir, adicioná-la
        if (columns.length === 0) {
          console.log('Adicionando coluna parent_id à tabela resources');
          
          await queryInterface.addColumn('resources', 'parent_id', {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: 'resources',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          });
          
          console.log('Coluna parent_id adicionada com sucesso');
        } else {
          console.log('A coluna parent_id já existe na tabela resources');
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
        // Verificar se a coluna parent_id existe
        const [columns] = await queryInterface.sequelize.query(`
          SELECT column_name
          FROM information_schema.columns 
          WHERE table_name = 'resources' AND column_name = 'parent_id'
        `);
        
        // Se a coluna existir, removê-la
        if (columns.length > 0) {
          console.log('Removendo coluna parent_id da tabela resources');
          
          await queryInterface.removeColumn('resources', 'parent_id');
          
          console.log('Coluna parent_id removida com sucesso');
        } else {
          console.log('A coluna parent_id não existe na tabela resources');
        }
      } else {
        console.log('A tabela resources não existe, não é possível remover a coluna');
      }
    } catch (error) {
      console.error('Erro ao reverter migração:', error);
    }
  }
}; 