'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Verificar se a tabela existe
      const tables = await queryInterface.showAllTables();
      if (!tables.includes('learning_modules')) {
        console.log('Tabela learning_modules não existe, não é necessário migrar');
        return;
      }

      // Verificar se a coluna keywords existe
      const [columns] = await queryInterface.sequelize.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'learning_modules' AND column_name = 'keywords'
      `);

      if (columns.length === 0) {
        // A coluna não existe, adicionar como JSONB
        await queryInterface.sequelize.query(`
          ALTER TABLE learning_modules 
          ADD COLUMN keywords JSONB DEFAULT '[]'::jsonb
        `);
        console.log('Coluna keywords adicionada como JSONB');
      } else if (columns[0].data_type.includes('varying') && columns[0].data_type.includes('[]')) {
        // A coluna existe como character varying[], precisamos criar uma nova coluna
        // Vamos primeiro renomear a coluna existente
        await queryInterface.sequelize.query(`
          ALTER TABLE learning_modules 
          RENAME COLUMN keywords TO keywords_old
        `);
        console.log('Coluna keywords renomeada para keywords_old');
        
        // Criar nova coluna como JSONB
        await queryInterface.sequelize.query(`
          ALTER TABLE learning_modules 
          ADD COLUMN keywords JSONB DEFAULT '[]'::jsonb
        `);
        console.log('Nova coluna keywords adicionada como JSONB');
        
        // Copiar os dados convertendo array para JSONB
        await queryInterface.sequelize.query(`
          UPDATE learning_modules 
          SET keywords = COALESCE(
            to_json(keywords_old)::jsonb, 
            '[]'::jsonb
          )
          WHERE keywords_old IS NOT NULL
        `);
        console.log('Dados migrados de keywords_old para keywords');
        
        // Opcionalmente, remover coluna antiga após migração bem-sucedida
        // await queryInterface.sequelize.query(`
        //   ALTER TABLE learning_modules 
        //   DROP COLUMN keywords_old
        // `);
        // console.log('Coluna antiga keywords_old removida');
      } else if (columns[0].data_type !== 'jsonb') {
        // A coluna existe mas não é JSONB, tentar converter utilizando to_json
        await queryInterface.sequelize.query(`
          ALTER TABLE learning_modules 
          ALTER COLUMN keywords TYPE JSONB USING 
            CASE 
              WHEN keywords IS NULL THEN '[]'::jsonb
              ELSE to_json(keywords)::jsonb
            END
        `);
        console.log('Coluna keywords convertida para JSONB');
      } else {
        console.log('Coluna keywords já está no formato correto');
      }

      // Garantir que o valor padrão seja definido corretamente
      await queryInterface.sequelize.query(`
        ALTER TABLE learning_modules 
        ALTER COLUMN keywords SET DEFAULT '[]'::jsonb
      `);
      console.log('Valor padrão da coluna keywords definido corretamente');

    } catch (error) {
      console.error('Erro na migração da coluna keywords:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // A reversão não é necessária, pois estamos apenas corrigindo a coluna
    console.log('Nenhuma ação de reversão necessária');
  }
}; 