const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Garantir uso do nome correto da tabela ("Menus")
        const tableName = 'Menus';
        // Verificar se a coluna já existe
        const table = await queryInterface.describeTable(tableName);
        if (!table.resource_id) {
            await queryInterface.addColumn(tableName, 'resource_id', {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                    model: 'resources',
                    key: 'id'
                }
            });
        }
    },
    down: async (queryInterface, Sequelize) => {
        const tableName = 'Menus';
        const table = await queryInterface.describeTable(tableName);
        if (table.resource_id) {
            await queryInterface.removeColumn(tableName, 'resource_id');
        }
    }
}; 