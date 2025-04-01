const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Component = sequelize.define('Component', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    content: {
        type: DataTypes.JSONB,
        defaultValue: {}
    }
}, {
    tableName: 'components',
    timestamps: true
});

module.exports = Component; 