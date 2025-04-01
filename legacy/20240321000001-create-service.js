'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('services', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            title: {
                type: Sequelize.STRING,
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT
            },
            status: {
                type: Sequelize.STRING,
                defaultValue: 'pending'
            },
            priority: {
                type: Sequelize.STRING,
                defaultValue: 'medium'
            },
            due_date: {
                type: Sequelize.DATE
            },
            assigned_to: {
                type: Sequelize.UUID,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            created_by: {
                type: Sequelize.UUID,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            category: {
                type: Sequelize.STRING
            },
            tags: {
                type: Sequelize.ARRAY(Sequelize.STRING),
                defaultValue: []
            },
            attachments: {
                type: Sequelize.JSONB,
                defaultValue: []
            },
            comments: {
                type: Sequelize.JSONB,
                defaultValue: []
            },
            time_estimate: {
                type: Sequelize.INTEGER
            },
            time_spent: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            archived: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
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
        await queryInterface.dropTable('services');
    }
}; 