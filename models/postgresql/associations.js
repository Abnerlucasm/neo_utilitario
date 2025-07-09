'use strict';

const { sequelize } = require('../../config/database');
const { DataTypes } = require('sequelize');

// Importar definições dos modelos
const defineUser = require('./User');
const defineRole = require('./Role');
const definePermission = require('./Permission');
const defineLearningModule = require('./LearningModule');
const defineUserProgress = require('./UserProgress');
const defineService = require('./Service');
const defineSession = require('./Session');
const defineResource = require('./Resource');
const defineSuggestion = require('./Suggestion');
const defineGlassfish = require('./Glassfish');
const defineMenu = require('./Menu');
const defineRolePermission = require('./RolePermission');
const defineUserRole = require('./UserRole');
const defineRoleResource = require('./RoleResource');
const defineComponent = require('./Component');

// Inicializar modelos
const User = defineUser(sequelize);
const Role = defineRole(sequelize);
const Permission = definePermission(sequelize);
const LearningModule = defineLearningModule(sequelize);
const UserProgress = defineUserProgress(sequelize);
const Service = defineService(sequelize);
const Session = defineSession(sequelize);
const Resource = defineResource(sequelize);
const Suggestion = defineSuggestion(sequelize);
const Glassfish = defineGlassfish(sequelize);
const Menu = defineMenu(sequelize);
const RolePermission = defineRolePermission(sequelize);
const UserRole = defineUserRole(sequelize);
const RoleResource = defineRoleResource(sequelize);
const Component = defineComponent(sequelize);

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

    // User - LearningModule
    User.hasMany(LearningModule, {
        foreignKey: 'created_by',
        as: 'createdModules'
    });

    LearningModule.belongsTo(User, {
        foreignKey: 'created_by',
        as: 'creator'
    });

    // User - UserProgress
    User.hasMany(UserProgress, {
        foreignKey: 'user_id',
        as: 'userProgress'
    });

    UserProgress.belongsTo(User, {
        foreignKey: 'user_id',
        as: 'user'
    });

    // LearningModule - UserProgress
    LearningModule.hasMany(UserProgress, {
        foreignKey: 'module_id',
        as: 'userProgresses'
    });

    UserProgress.belongsTo(LearningModule, {
        foreignKey: 'module_id',
        as: 'module'
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
    Menu.associate({ Menu });

    // Component - User
    Component.belongsTo(User, {
        foreignKey: 'created_by',
        as: 'creator'
    });

    User.hasMany(Component, {
        foreignKey: 'created_by',
        as: 'components'
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
    LearningModule,
    UserProgress,
    Service,
    Session,
    Resource,
    Suggestion,
    Glassfish,
    Menu,
    RolePermission,
    UserRole,
    RoleResource,
    Component,
    initAssociations
}; 