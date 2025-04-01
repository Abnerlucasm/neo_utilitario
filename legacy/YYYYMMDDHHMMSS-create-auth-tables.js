'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = async (tableName) => {
      try {
        await queryInterface.describeTable(tableName);
        return true;
      } catch (e) {
        return false;
      }
    };

    // Criar tabela de roles se não existir
    if (!(await tableExists('roles'))) {
      await queryInterface.createTable('roles', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        description: {
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
    }

    // Criar tabela de resources se não existir
    if (!(await tableExists('resources'))) {
      await queryInterface.createTable('resources', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        path: {
          type: Sequelize.STRING,
          allowNull: false
        },
        description: {
          type: Sequelize.STRING
        },
        icon: {
          type: Sequelize.STRING
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
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
    }

    // Criar tabela de relacionamento user_roles se não existir
    if (!(await tableExists('user_roles'))) {
      await queryInterface.createTable('user_roles', {
        user_id: {
          type: Sequelize.INTEGER,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        role_id: {
          type: Sequelize.INTEGER,
          references: {
            model: 'roles',
            key: 'id'
          },
          onDelete: 'CASCADE'
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
    }

    // Criar tabela de relacionamento role_resources se não existir
    if (!(await tableExists('role_resources'))) {
      await queryInterface.createTable('role_resources', {
        role_id: {
          type: Sequelize.INTEGER,
          references: {
            model: 'roles',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        resource_id: {
          type: Sequelize.INTEGER,
          references: {
            model: 'resources',
            key: 'id'
          },
          onDelete: 'CASCADE'
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
    }

    // Adicionar índices se não existirem
    try {
      await queryInterface.addIndex('user_roles', ['user_id', 'role_id'], {
        unique: true,
        name: 'user_roles_user_id_role_id_unique'
      });
    } catch (error) {
      console.log('Índice user_roles já existe');
    }

    try {
      await queryInterface.addIndex('role_resources', ['role_id', 'resource_id'], {
        unique: true,
        name: 'role_resources_role_id_resource_id_unique'
      });
    } catch (error) {
      console.log('Índice role_resources já existe');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remover na ordem inversa para evitar erros de chave estrangeira
    await queryInterface.dropTable('role_resources').catch(() => {});
    await queryInterface.dropTable('user_roles').catch(() => {});
    await queryInterface.dropTable('resources').catch(() => {});
    await queryInterface.dropTable('roles').catch(() => {});
  }
}; 