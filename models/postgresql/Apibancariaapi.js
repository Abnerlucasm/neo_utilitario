'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class ApiBancariaApi extends Model {
        static associate(models) {
            // Associações definidas em associations.js
        }
    }

    ApiBancariaApi.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        integrationId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'api_bancaria_integracoes',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        name: {
            // Ex: "Cobrança", "Webhook", "Pag. boletos", "Pag. Pix", "Pag. TED","Pag. concessionária", "DDA", "Extrato"    
            type: DataTypes.STRING(60),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'O nome da API é obrigatório' }
            }
        }
    }, {
        sequelize,
        modelName: 'ApiBancariaApi',
        tableName: 'api_bancaria_apis',
        underscored: true,
        indexes: [
            { name: 'idx_api_bancaria_apis_integration_id', fields: ['integration_id'] },
            { name: 'uq_api_bancaria_apis_integration_name', unique: true, fields: ['integration_id', 'name'] }
        ]
    });

    return ApiBancariaApi;
};