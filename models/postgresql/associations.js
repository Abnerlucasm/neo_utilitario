'use strict';

const { sequelize } = require('../../config/database');
const { DataTypes } = require('sequelize');

// Importar definições dos modelos
const defineUser = require('./User');
const defineRole = require('./Role');
const definePermission = require('./Permission');
const defineService = require('./Service');
const defineSession = require('./session');
const defineResource = require('./Resource');
const defineSuggestion = require('./suggestion');
const defineGlassfish = require('./Glassfish');
const defineMenu = require('./Menu');
const defineRolePermission = require('./RolePermission');
const defineUserRole = require('./UserRole');
const defineRoleResource = require('./RoleResource');
const Server = require('./Server');
const defineDatabaseCache = require('./DatabaseCache');

// Inicializar modelos
const User = defineUser(sequelize);
const Role = defineRole(sequelize);
const Permission = definePermission(sequelize);
const Service = defineService(sequelize);
const Session = defineSession(sequelize);
const Resource = defineResource(sequelize);
const Suggestion = defineSuggestion(sequelize);
const Glassfish = defineGlassfish(sequelize);
const Menu = defineMenu(sequelize);
const RolePermission = defineRolePermission(sequelize);
const UserRole = defineUserRole(sequelize);
const RoleResource = defineRoleResource(sequelize);
const DatabaseCache = defineDatabaseCache(sequelize);

// Definir as associações
function initAssociations() {
    // User - Role
    User.belongsToMany(Role, {
        through: 'user_roles',
        foreignKey: 'user_id',
        otherKey: 'role_id',
        as: 'userRoles'
    });

    Role.belongsToMany(User, {
        through: 'user_roles',
        foreignKey: 'role_id',
        otherKey: 'user_id',
        as: 'users'
    });

    // User - Service
    User.hasMany(Service, {
        foreignKey: 'created_by',
        as: 'createdServices'
    });

    User.hasMany(Service, {
        foreignKey: 'assigned_to',
        as: 'assignedServices'
    });

    Service.belongsTo(User, {
        foreignKey: 'created_by',
        as: 'creator'
    });

    Service.belongsTo(User, {
        foreignKey: 'assigned_to',
        as: 'assignee'
    });

        // Role - Resource
        Role.belongsToMany(Resource, {
            through: 'role_resources',
            foreignKey: 'role_id',
            otherKey: 'resource_id',
            as: 'accessibleResources'
        });
    
        Resource.belongsToMany(Role, {
            through: 'role_resources',
            foreignKey: 'resource_id',
            otherKey: 'role_id',
            as: 'roles'
        });
    
        // Associações auto-referenciais do Resource (parent-child)
        Resource.belongsTo(Resource, { 
            foreignKey: 'parent_id', 
            as: 'parent' 
        });
        
        Resource.hasMany(Resource, { 
            foreignKey: 'parent_id', 
            as: 'children' 
        });

    // User - Session
    User.hasMany(Session, {
        foreignKey: 'user_id',
        as: 'sessions'
    });

    Session.belongsTo(User, {
        foreignKey: 'user_id',
        as: 'user'
    });

    // Role - Permission
    Role.belongsToMany(Permission, {
        through: 'role_permissions',
        foreignKey: 'role_id',
        otherKey: 'permission_id',
        as: 'permissions'
    });

    Permission.belongsToMany(Role, {
        through: 'role_permissions',
        foreignKey: 'permission_id',
        otherKey: 'role_id',
        as: 'roles'
    });


    // Associações do Menu
    Menu.associate({ Menu, Resource });

    // User - Server
    User.hasMany(Server, {
        foreignKey: 'createdBy',
        as: 'createdServers'
    });

    Server.belongsTo(User, {
        foreignKey: 'createdBy',
        as: 'creator'
    });

    User.hasMany(Server, {
        foreignKey: 'updatedBy',
        as: 'updatedServers'
    });

    Server.belongsTo(User, {
        foreignKey: 'updatedBy',
        as: 'updater'
    });

    // Server - DatabaseCache
    Server.hasMany(DatabaseCache, {
        foreignKey: 'serverId',
        as: 'databaseCaches'
    });

    DatabaseCache.belongsTo(Server, {
        foreignKey: 'serverId',
        as: 'server'
    });
}

// Aplicar as associações imediatamente
initAssociations();

// Exportar modelos e função de inicialização
module.exports = {
    sequelize,
    User,
    Role,
    Permission,
    Service,
    Session,
    Suggestion,
    Glassfish,
    Menu,
    RolePermission,
    UserRole,
    Resource,
    RoleResource,
    Server,
    DatabaseCache,
    initAssociations
}; 