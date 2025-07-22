'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Adiciona nova coluna uuid temporária
    await queryInterface.addColumn('servers', 'uuid', {
      type: Sequelize.UUID,
      defaultValue: Sequelize.fn('gen_random_uuid'),
      allowNull: false,
      unique: true
    });

    // 2. Copia o valor do id antigo para uma coluna auxiliar (opcional, para rastreio)
    await queryInterface.addColumn('servers', 'old_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.sequelize.query('UPDATE servers SET old_id = id');

    // 3. Remove a constraint de chave primária antiga
    await queryInterface.removeConstraint('servers', 'servers_pkey');

    // 4. Remove a coluna id antiga
    await queryInterface.removeColumn('servers', 'id');

    // 5. Renomeia a coluna uuid para id
    await queryInterface.renameColumn('servers', 'uuid', 'id');

    // 6. Define a nova coluna como chave primária
    await queryInterface.changeColumn('servers', 'id', {
      type: Sequelize.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: Sequelize.fn('gen_random_uuid')
    });
  },

  async down(queryInterface, Sequelize) {
    // Não implementado (migração irreversível)
    throw new Error('Irreversível');
  }
}; 