'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // 1. Adicionar a coluna name permitindo null
        await queryInterface.addColumn('users', 'name', {
            type: Sequelize.STRING,
            allowNull: true
        });

        // 2. Atualizar registros existentes copiando o username para name
        await queryInterface.sequelize.query(`
            UPDATE users 
            SET name = username 
            WHERE name IS NULL;
        `);

        // 3. Alterar a coluna para not null
        await queryInterface.changeColumn('users', 'name', {
            type: Sequelize.STRING,
            allowNull: false
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('users', 'name');
    }
}; 