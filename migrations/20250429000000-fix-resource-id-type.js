'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    try {
      // Verificar se a tabela role_resources existe
      const roleResourcesExists = await queryInterface.showAllTables()
        .then(tables => tables.includes('role_resources'));
      
      if (roleResourcesExists) {
        // Verificar o tipo atual da coluna
        const [columns] = await queryInterface.sequelize.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'role_resources' AND column_name = 'resource_id'
        `);
        
        // Se for INTEGER, precisamos alterar para UUID
        if (columns.length > 0 && columns[0].data_type.toLowerCase() === 'integer') {
          console.log('Alterando tipo da coluna resource_id de INTEGER para UUID');
          
          // 1. Renomear a tabela antiga
          await queryInterface.renameTable('role_resources', 'role_resources_old');
          
          // 2. Criar nova tabela com o tipo correto
          await queryInterface.createTable('role_resources', {
            id: {
              type: Sequelize.UUID,
              defaultValue: Sequelize.UUIDV4,
              primaryKey: true
            },
            role_id: {
              type: Sequelize.UUID,
              allowNull: false,
              references: {
                model: 'roles',
                key: 'id'
              }
            },
            resource_id: {
              type: Sequelize.UUID,
              allowNull: false,
              references: {
                model: 'resources',
                key: 'id'
              }
            },
            created_at: {
              type: Sequelize.DATE,
              allowNull: false,
              defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updated_at: {
              type: Sequelize.DATE,
              allowNull: false,
              defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
          });
          
          console.log('Nova tabela role_resources criada com sucesso');
          
          // Não tentaremos migrar dados automaticamente devido à incompatibilidade
          console.log('ATENÇÃO: Os dados da tabela role_resources não foram migrados automaticamente.');
          console.log('Será necessário recriar as associações entre papéis e recursos.');
        } else {
          console.log('O tipo da coluna resource_id já está correto ou não foi encontrado');
        }
      } else {
        console.log('A tabela role_resources não existe, não é necessário migrar');
      }
    } catch (error) {
      console.error('Erro durante a migração:', error);
    }
  },

  async down (queryInterface, Sequelize) {
    try {
      // Verificar se a tabela de backup ainda existe
      const backupExists = await queryInterface.showAllTables()
        .then(tables => tables.includes('role_resources_old'));
      
      if (backupExists) {
        // Remover a nova tabela
        await queryInterface.dropTable('role_resources');
        
        // Restaurar a tabela antiga
        await queryInterface.renameTable('role_resources_old', 'role_resources');
        
        console.log('Rollback concluído com sucesso');
      } else {
        console.log('Não foi possível fazer rollback, a tabela de backup não existe');
      }
    } catch (error) {
      console.error('Erro ao reverter migração:', error);
    }
  }
}; 