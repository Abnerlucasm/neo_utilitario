'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('servers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Nome do servidor'
      },
      host: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'IP ou hostname do servidor'
      },
      port: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5432,
        comment: 'Porta do banco de dados'
      },
      username: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Usuário do banco de dados'
      },
      password: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Senha do banco de dados (criptografada)'
      },
      type: {
        type: Sequelize.ENUM('postgresql', 'mysql', 'sqlserver', 'oracle'),
        allowNull: false,
        defaultValue: 'postgresql',
        comment: 'Tipo do banco de dados'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Descrição do servidor'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Status ativo/inativo'
      },
      last_connection: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Última tentativa de conexão'
      },
      connection_status: {
        type: Sequelize.ENUM('online', 'offline', 'error'),
        allowNull: false,
        defaultValue: 'offline',
        comment: 'Status da conexão'
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'ID do usuário que criou o servidor'
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'ID do usuário que atualizou o servidor'
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
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Criar índices
    await queryInterface.addIndex('servers', ['host', 'port'], {
      unique: true,
      name: 'servers_host_port_unique'
    });

    await queryInterface.addIndex('servers', ['is_active'], {
      name: 'servers_is_active_idx'
    });

    await queryInterface.addIndex('servers', ['connection_status'], {
      name: 'servers_connection_status_idx'
    });

    await queryInterface.addIndex('servers', ['created_by'], {
      name: 'servers_created_by_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('servers');
  }
}; 