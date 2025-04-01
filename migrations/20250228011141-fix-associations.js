'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Verificar se a tabela user_roles existe e criar se não existir
    try {
      const userRolesExists = await queryInterface.showAllTables()
        .then(tables => tables.includes('user_roles'));
      
      if (!userRolesExists) {
        await queryInterface.createTable('user_roles', {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true
          },
          user_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'users',
              key: 'id'
            }
          },
          role_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'roles',
              key: 'id'
            }
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
          }
        });
      }

      // Verificar se a tabela role_permissions existe e criar se não existir
      const rolePermissionsExists = await queryInterface.showAllTables()
        .then(tables => tables.includes('role_permissions'));
      
      if (!rolePermissionsExists) {
        await queryInterface.createTable('role_permissions', {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true
          },
          role_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'roles',
              key: 'id'
            }
          },
          permission_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'permissions',
              key: 'id'
            }
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
          }
        });
      }

      // Verificar se a tabela role_resources existe e criar se não existir
      const roleResourcesExists = await queryInterface.showAllTables()
        .then(tables => tables.includes('role_resources'));
      
      if (!roleResourcesExists) {
        await queryInterface.createTable('role_resources', {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true
          },
          role_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'roles',
              key: 'id'
            }
          },
          resource_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'resources',
              key: 'id'
            }
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
          }
        });
      }
    } catch (error) {
      console.error('Erro durante a migração:', error);
    }
  },

  async down (queryInterface, Sequelize) {
    // Reverter alterações
    try {
      await queryInterface.dropTable('role_resources');
      await queryInterface.dropTable('role_permissions');
      await queryInterface.dropTable('user_roles');
    } catch (error) {
      console.error('Erro ao reverter migração:', error);
    }
  }
}; 