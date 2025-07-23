'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('users', 'avatar', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Caminho relativo da imagem/avatar do usuário'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('users', 'avatar');
    }
};
