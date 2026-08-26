'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class ApiBancariaCertificado extends Model {
        static associate(models) {
            // Associações definidas em associations.js
        }
    }

    ApiBancariaCertificado.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        apiId: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true, //relação 1:1 certificado:integração
            references: {
                model: 'api_bancaria_apis',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        label: {
            type: DataTypes.STRING(120),
            allowNull: true,
            comment: 'Identificação do certificado, ex: Produção - matriz'
        },
        expiresOn: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            comment: 'Data de vencimento do certificado'
        },
        createdBy: {
            type: DataTypes.UUID,
            allowNull: true,
            comment: 'ID do usuário que cadastrou o certificado'
        }
    }, {
        sequelize,
        modelName: 'ApiBancariaCertificado',
        tableName: 'api_bancaria_certificados',
        underscored: true,
        indexes: [
            { name: 'idx_api_bancaria_certificados_expires_on', fields: ['expires_on'] }
        ]
    });

    return ApiBancariaCertificado;
};