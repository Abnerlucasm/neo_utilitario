'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class RoleResource extends Model {}

    RoleResource.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        role_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'roles',
                key: 'id'
            }
        },
        resource_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'resources',
                key: 'id'
            }
        }
    }, {
        sequelize,
        modelName: 'RoleResource',
        tableName: 'role_resources',
        underscored: true
    });

    return RoleResource;
}; 