'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class ApiBancariaCliente extends Model {
        static associate(models) {
            // Associações definidas em associations.js
        }
    }

    ApiBancariaCliente.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING(120),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'O nome da empresa é obrigatório' }
            }
        },
        document: {
            type: DataTypes.STRING(30),
            allowNull: true,
            comment: 'CNPJ do cliente',
            validate: {
                notEmpty: { msg: 'O CNPJ da empresa é obrigatório' }
            }
        },
        returnType: {
            type: DataTypes.ENUM('CNAB', 'API'),
            allowNull: true
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        createdBy: {
            type: DataTypes.UUID,
            allowNull: true,
            comment: 'ID do usuário que cadastrou o cliente'
        },
        updatedBy: {
            type: DataTypes.UUID,
            allowNull: true,
            comment: 'ID do usuário que atualizou o cliente pela última vez'
        }
    }, {
        sequelize,
        modelName: 'ApiBancariaCliente',
        tableName: 'api_bancaria_clientes',
        underscored: true,
        indexes: [
            { name: 'idx_api_bancaria_clientes_name',     fields: ['name'] },
            { name: 'idx_api_bancaria_clientes_document', fields: ['document'] }
        ]
    });

    return ApiBancariaCliente;
};