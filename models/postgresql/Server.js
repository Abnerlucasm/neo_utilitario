const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Server = sequelize.define('Server', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Nome do servidor'
    },
    host: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'IP ou hostname do servidor'
    },
    port: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5432,
        comment: 'Porta do banco de dados'
    },
    username: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Usuário do banco de dados'
    },
    password: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Senha do banco de dados (criptografada)'
    },
    type: {
        type: DataTypes.ENUM('postgresql', 'mysql', 'sqlserver', 'oracle'),
        allowNull: false,
        defaultValue: 'postgresql',
        comment: 'Tipo do banco de dados'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Descrição do servidor'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Status ativo/inativo'
    },
    lastConnection: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Última tentativa de conexão'
    },
    connectionStatus: {
        type: DataTypes.ENUM('online', 'offline', 'error'),
        allowNull: false,
        defaultValue: 'offline',
        comment: 'Status da conexão'
    },
    createdBy: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'ID do usuário que criou o servidor'
    },
    updatedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID do usuário que atualizou o servidor'
    }
}, {
    tableName: 'servers',
    timestamps: true,
    paranoid: true, // Soft delete
    indexes: [
        {
            fields: ['host', 'port']
        },
        {
            fields: ['is_active']
        },
        {
            fields: ['connection_status']
        }
    ]
});

module.exports = Server; 