'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            // Verificar se a tabela já existe
            const tableExists = await queryInterface.showAllTables()
                .then(tables => tables.includes('user_sessions'));

            if (!tableExists) {
                await queryInterface.createTable('user_sessions', {
                    sid: {
                        type: Sequelize.STRING,
                        primaryKey: true
                    },
                    sess: {
                        type: Sequelize.JSON,
                        allowNull: false
                    },
                    expire: {
                        type: Sequelize.DATE,
                        allowNull: false
                    }
                });

                // Verificar se o índice existe antes de criar
                const [results] = await queryInterface.sequelize.query(
                    `SELECT indexname FROM pg_indexes WHERE indexname = 'IDX_session_expire'`
                );

                if (!results.length) {
                    await queryInterface.addIndex('user_sessions', ['expire'], {
                        name: 'IDX_session_expire'
                    });
                }
            }
        } catch (error) {
            console.error('Erro na migração:', error);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        try {
            // Remover índice se existir
            await queryInterface.sequelize.query(
                `DROP INDEX IF EXISTS "IDX_session_expire"`
            );
            
            // Remover tabela
            await queryInterface.dropTable('user_sessions');
        } catch (error) {
            console.error('Erro ao reverter migração:', error);
            throw error;
        }
    }
}; 