'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class GlassfishCategory extends Model {
        static associate(models) {
            // Sem associações diretas — Glassfish referencia categoria por nome (string no config)
        }
    }

    GlassfishCategory.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
            validate: { notEmpty: true }
        },
        description: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        color: {
            // Cor hex para identificação visual no badge
            type: DataTypes.STRING(7),
            allowNull: true,
            defaultValue: '#6b7280'
        },
        active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        sequelize,
        modelName: 'GlassfishCategory',
        tableName:  'glassfish_categories',
        underscored: true,
    });

    return GlassfishCategory;
};