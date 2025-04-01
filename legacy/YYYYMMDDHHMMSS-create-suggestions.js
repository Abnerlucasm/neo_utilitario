'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('suggestions', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            sequential_number: {
                type: Sequelize.INTEGER,
                unique: true,
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            category: {
                type: Sequelize.ENUM('correcao', 'melhoria', 'novo'),
                allowNull: false
            },
            status: {
                type: Sequelize.ENUM('pending', 'in_progress', 'implemented'),
                defaultValue: 'pending'
            },
            created_by: {
                type: Sequelize.STRING,
                allowNull: false
            },
            upvotes: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            downvotes: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            voted_by: {
                type: Sequelize.JSONB,
                defaultValue: []
            },
            comments: {
                type: Sequelize.JSONB,
                defaultValue: []
            },
            image_url: {
                type: Sequelize.STRING
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('suggestions');
    }
}; 