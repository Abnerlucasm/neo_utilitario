'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();
    
    // Verificar se as permissões já existem
    const existingPermissions = await queryInterface.sequelize.query(
      'SELECT name FROM permissions WHERE name IN (:names)',
      {
        replacements: { names: ['admin_manage', 'users_manage'] },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    const existingNames = existingPermissions.map(p => p.name);
    
    // Filtrar apenas as permissões que não existem
    const newPermissions = [
      {
        id: Sequelize.literal('uuid_generate_v4()'),
        name: 'admin_manage',
        description: 'Gerenciar configurações administrativas',
        resource: 'admin',
        action: 'manage',
        created_at: now,
        updated_at: now
      },
      {
        id: Sequelize.literal('uuid_generate_v4()'),
        name: 'users_manage',
        description: 'Gerenciar usuários',
        resource: 'users',
        action: 'manage',
        created_at: now,
        updated_at: now
      }
    ].filter(p => !existingNames.includes(p.name));

    if (newPermissions.length > 0) {
      await queryInterface.bulkInsert('permissions', newPermissions, {});
    }

    // Verificar se o papel de admin já existe
    const [existingRole] = await queryInterface.sequelize.query(
      'SELECT id FROM roles WHERE name = :name',
      {
        replacements: { name: 'Administrador' },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    let adminRoleId;

    if (!existingRole) {
      // Criar papel de admin se não existir
      const [adminRole] = await queryInterface.bulkInsert('roles', [{
        id: Sequelize.literal('uuid_generate_v4()'),
        name: 'Administrador',
        description: 'Acesso total ao sistema',
        created_at: now,
        updated_at: now
      }], { returning: true });
      adminRoleId = adminRole.id;
    } else {
      adminRoleId = existingRole.id;
    }

    // Buscar todas as permissões existentes
    const allPermissions = await queryInterface.sequelize.query(
      'SELECT id FROM permissions',
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Verificar permissões já associadas
    const existingRolePermissions = await queryInterface.sequelize.query(
      'SELECT permission_id FROM role_permissions WHERE role_id = :roleId',
      {
        replacements: { roleId: adminRoleId },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    const existingPermissionIds = existingRolePermissions.map(rp => rp.permission_id);

    // Filtrar apenas as permissões que ainda não estão associadas
    const newRolePermissions = allPermissions
      .filter(permission => !existingPermissionIds.includes(permission.id))
      .map(permission => ({
        role_id: adminRoleId,
        permission_id: permission.id,
        created_at: now,
        updated_at: now
      }));

    if (newRolePermissions.length > 0) {
      await queryInterface.bulkInsert('role_permissions', newRolePermissions);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('role_permissions', null, {});
    await queryInterface.bulkDelete('roles', null, {});
    await queryInterface.bulkDelete('permissions', {
      name: ['admin_manage', 'users_manage']
    }, {});
  }
}; 