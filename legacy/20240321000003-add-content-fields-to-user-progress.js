'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const table = 'user_progress';
        const tableInfo = await queryInterface.describeTable(table);

        // Adicionar content_type se não existir
        if (!tableInfo.content_type) {
            await queryInterface.addColumn(table, 'content_type', {
                type: Sequelize.STRING,
                allowNull: true
            });
        }

        // Adicionar completed_pages se não existir
        if (!tableInfo.completed_pages) {
            await queryInterface.addColumn(table, 'completed_pages', {
                type: Sequelize.ARRAY(Sequelize.STRING),
                defaultValue: []
            });
        }

        // Adicionar total_pages se não existir
        if (!tableInfo.total_pages) {
            await queryInterface.addColumn(table, 'total_pages', {
                type: Sequelize.INTEGER,
                defaultValue: 0
            });
        }

        // Verificar se o índice já existe antes de criar
        try {
            await queryInterface.addIndex(table, ['content_type'], {
                name: 'user_progress_content_type_idx'
            });
        } catch (error) {
            // Se o índice já existir, ignorar o erro
            if (!error.message.includes('already exists')) {
                throw error;
            }
        }
    },

    down: async (queryInterface, Sequelize) => {
        const table = 'user_progress';
        
        // Remover índice se existir
        try {
            await queryInterface.removeIndex(table, 'user_progress_content_type_idx');
        } catch (error) {
            // Ignorar erro se o índice não existir
            console.log('Índice não encontrado para remoção');
        }

        // Remover colunas se existirem
        const tableInfo = await queryInterface.describeTable(table);
        
        if (tableInfo.content_type) {
            await queryInterface.removeColumn(table, 'content_type');
        }
        if (tableInfo.completed_pages) {
            await queryInterface.removeColumn(table, 'completed_pages');
        }
        if (tableInfo.total_pages) {
            await queryInterface.removeColumn(table, 'total_pages');
        }
    }
}; 