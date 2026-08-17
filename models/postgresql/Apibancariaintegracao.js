'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class ApiBancariaIntegracao extends Model {
        static associate(models) {
            // Associações definidas em associations.js
        }
    }

    ApiBancariaIntegracao.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        clientId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'api_bancaria_clientes',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        bank: {
            type: DataTypes.STRING(80),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'O banco é obrigatório' }
            }
        },
        createdBy: {
            type: DataTypes.UUID,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'ApiBancariaIntegracao',
        tableName: 'api_bancaria_integracoes',
        underscored: true,
        indexes: [
            { name: 'idx_api_bancaria_integracoes_client_id', fields: ['client_id'] },
            { name: 'uq_api_bancaria_integracoes_client_bank', unique: true, fields: ['client_id', 'bank'] }
        ]
    });

    return ApiBancariaIntegracao;
};