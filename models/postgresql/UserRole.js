'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class UserRole extends Model {}

    UserRole.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        role_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'roles',
                key: 'id'
            }
        }
    }, {
        sequelize,
        modelName: 'UserRole',
        tableName: 'user_roles',
        underscored: true
    });

    return UserRole;
}; 