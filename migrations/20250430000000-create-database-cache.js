'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('database_cache', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      server_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'servers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      server_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      server_host: {
        type: Sequelize.STRING,
        allowNull: false
      },
      databases: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      },
      last_updated: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      status: {
        type: Sequelize.ENUM('success', 'error', 'pending'),
        allowNull: false,
        defaultValue: 'pending'
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      total_databases: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      cache_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Criar índices para performance
    await queryInterface.addIndex('database_cache', ['server_id'], {
      name: 'idx_database_cache_server_id'
    });

    await queryInterface.addIndex('database_cache', ['last_updated'], {
      name: 'idx_database_cache_last_updated'
    });

    await queryInterface.addIndex('database_cache', ['status'], {
      name: 'idx_database_cache_status'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('database_cache');
  }
}; 