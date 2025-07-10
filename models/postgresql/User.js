'use strict';

const { Model, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

module.exports = (sequelize) => {
    class User extends Model {
        static associate(models) {
            this.hasMany(models.LearningModule, {
                foreignKey: 'created_by',
                as: 'createdModules'
            });
            this.hasMany(models.UserProgress, {
                foreignKey: 'user_id',
                as: 'userProgress'
            });
            this.hasMany(models.Service, {
                foreignKey: 'created_by',
                as: 'createdServices'
            });
            this.hasMany(models.Service, {
                foreignKey: 'assigned_to',
                as: 'assignedServices'
            });
        }

        async validatePassword(password) {
            try {
                if (!this.password) {
                    logger.warn('Tentativa de validar senha para usuário sem senha definida', {
                        userId: this.id,
                        email: this.email
                    });
                    return false;
                }
                
                // Comparar a senha com bcrypt
                const result = await bcrypt.compare(password, this.password);
                logger.debug(`Resultado da validação de senha para ${this.email}: ${result}`);
                return result;
            } catch (error) {
                logger.error('Erro ao validar senha:', error);
                throw error;
            }
        }

        // Métodos para verificar roles
        async hasRole(roleName) {
            try {
                const { Role } = require('../postgresql/associations');
                const userWithRoles = await this.sequelize.models.User.findByPk(this.id, {
                    include: [{
                        model: Role,
                        as: 'userRoles'
                    }]
                });
                
                if (!userWithRoles || !userWithRoles.userRoles) {
                    return false;
                }
                
                return userWithRoles.userRoles.some(role => role.name === roleName);
            } catch (error) {
                console.error('Erro ao verificar role:', error);
                return false;
            }
        }

        async hasUserRole(role) {
            try {
                const { Role } = require('../postgresql/associations');
                const userWithRoles = await this.sequelize.models.User.findByPk(this.id, {
                    include: [{
                        model: Role,
                        as: 'userRoles'
                    }]
                });
                
                if (!userWithRoles || !userWithRoles.userRoles) {
                    return false;
                }
                
                return userWithRoles.userRoles.some(r => r.id === role.id);
            } catch (error) {
                console.error('Erro ao verificar user role:', error);
                return false;
            }
        }

        async getRoles() {
            try {
                const { Role } = require('../postgresql/associations');
                const userWithRoles = await this.sequelize.models.User.findByPk(this.id, {
                    include: [{
                        model: Role,
                        as: 'userRoles'
                    }]
                });
                
                if (!userWithRoles || !userWithRoles.userRoles) {
                    return [];
                }
                
                return userWithRoles.userRoles;
            } catch (error) {
                console.error('Erro ao obter roles:', error);
                return [];
            }
        }
    }

    User.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: () => uuidv4(),
            primaryKey: true
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                notEmpty: true
            }
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        theme: {
            type: DataTypes.STRING,
            defaultValue: 'light'
        },
        reset_token: {
            type: DataTypes.STRING,
            allowNull: true
        },
        reset_token_expires: {
            type: DataTypes.DATE,
            allowNull: true
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        email_verified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        is_admin: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        verification_code: {
            type: DataTypes.STRING,
            allowNull: true
        },
        two_factor_secret: {
            type: DataTypes.STRING,
            allowNull: true
        },
        two_factor_enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        last_login: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        underscored: true,
        hooks: {
            beforeCreate: async (user) => {
                if (user.password) {
                    const salt = await bcrypt.genSalt(10);
                    user.password = await bcrypt.hash(user.password, salt);
                }
            },
            beforeUpdate: async (user) => {
                if (user.changed('password') && user.password) {
                    const salt = await bcrypt.genSalt(10);
                    user.password = await bcrypt.hash(user.password, salt);
                }
            }
        }
    });

    return User;
}; 