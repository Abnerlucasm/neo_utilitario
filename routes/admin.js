const express = require('express');
const router = express.Router();
const { Role, Permission, User, Resource, UserRole } = require('../models/postgresql/associations');
const { authenticate } = require('../middlewares/auth');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const { requireAdmin } = require('../middlewares/access-control');
const { sequelize } = require('../models/postgresql/associations');
const { Op } = require('sequelize');

// Middleware de autenticação
router.use(authenticate);

// ===== Rotas de Usuários =====

// Listar todos os usuários
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.findAll({
            include: [{
                model: Role,
                as: 'userRoles',
                through: { attributes: [] }
            }]
        });
        res.json(users);
    } catch (error) {
        logger.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
});

// Criar novo usuário
router.post('/users', async (req, res) => {
    try {
        const { username, email, password, roles, is_active } = req.body;

        logger.info('Tentativa de criar usuário:', { 
            username, 
            email, 
            hasPassword: !!password,
            roles 
        });

        // Validar campos obrigatórios
        if (!username || !email || !password || !roles || !roles.length) {
            logger.warn('Campos obrigatórios faltando:', {
                hasUsername: !!username,
                hasEmail: !!email,
                hasPassword: !!password,
                hasRoles: !!roles,
                rolesLength: roles?.length
            });
            return res.status(400).json({
                error: 'Campos obrigatórios faltando'
            });
        }

        // Verificar se o email já está em uso
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            logger.warn('Tentativa de criar usuário com email existente:', { email });
            return res.status(400).json({
                error: 'Email já está em uso'
            });
        }

        // Hash da senha
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        logger.debug('Senha processada:', {
            originalLength: password.length,
            hashedLength: hashedPassword.length
        });

        // Criar usuário
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            is_active: is_active !== undefined ? is_active : true
        });

        // Verificar e associar papéis
        const validRoles = await Role.findAll({
            where: {
                id: roles
            }
        });

        if (validRoles.length === 0) {
            logger.warn('Nenhum papel válido encontrado:', { providedRoles: roles });
            await user.destroy();
            return res.status(400).json({
                error: 'Nenhum papel válido fornecido'
            });
        }

        // Associar papéis ao usuário manualmente através da tabela de associação
        try {
            for (const role of validRoles) {
                await sequelize.query(
                    'INSERT INTO user_roles(user_id, role_id, created_at, updated_at) VALUES(?, ?, NOW(), NOW())',
                    {
                        replacements: [user.id, role.id],
                        type: sequelize.QueryTypes.INSERT
                    }
                );
            }
            
            logger.info('Papéis associados manualmente:', {
                userId: user.id,
                roles: validRoles.map(r => r.name)
            });
        } catch (error) {
            logger.error('Erro ao associar papéis:', error);
            await user.destroy();
            throw error;
        }

        // Buscar usuário com papéis para retornar
        const createdUser = await User.findByPk(user.id, {
            include: [{
                model: Role,
                as: 'userRoles',
                through: { attributes: [] }
            }],
            attributes: { exclude: ['password'] }
        });

        logger.info('Usuário criado com sucesso:', {
            userId: user.id,
            username: user.username,
            roles: validRoles.map(r => r.name)
        });

        // Teste de validação da senha
        const testValidation = await bcrypt.compare(password, user.password);
        logger.debug('Teste de validação da senha:', {
            userId: user.id,
            validationSuccessful: testValidation
        });

        res.status(201).json(createdUser);
    } catch (error) {
        logger.error('Erro ao criar usuário:', error);
        res.status(500).json({
            error: 'Erro ao criar usuário',
            details: error.message
        });
    }
});

// Atualizar usuário
router.put('/users/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, password, is_active, roles } = req.body;

        logger.info('Tentativa de atualizar usuário:', { 
            userId: id, 
            username,
            email,
            hasPassword: !!password,
            roles
        });

        const user = await User.findByPk(id);
        if (!user) {
            logger.warn('Usuário não encontrado para atualização:', { userId: id });
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Atualizar dados básicos
        const updates = {};
        if (username) updates.username = username;
        if (email) updates.email = email;
        if (typeof is_active !== 'undefined') updates.is_active = is_active;
        
        // Se uma nova senha foi fornecida, fazer o hash
        if (password && password.trim()) {
            logger.debug('Atualizando senha do usuário:', { userId: id });
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.password = hashedPassword;

            // Teste de validação da nova senha
            const testValidation = await bcrypt.compare(password, hashedPassword);
            logger.debug('Teste de validação da nova senha:', {
                userId: id,
                validationSuccessful: testValidation
            });
        }

        // Atualizar usuário
        await User.update(updates, {
            where: { id },
            returning: true
        });

        // Atualizar papéis se fornecidos
        if (roles && roles.length > 0) {
            const validRoles = await Role.findAll({
                where: { id: roles }
            });

            if (validRoles.length === 0) {
                logger.warn('Nenhum papel válido fornecido para atualização:', { roles });
                return res.status(400).json({ error: 'Nenhum papel válido fornecido' });
            }

            try {
                // Utilizar método alternativo para atualizar os papéis do usuário
                // Primeiro remover todas as associações existentes
                await UserRole.destroy({
                    where: { user_id: id }
                });
                
                // Depois criar as novas associações
                for (const role of validRoles) {
                    await sequelize.query(
                        'INSERT INTO user_roles(user_id, role_id, created_at, updated_at) VALUES(?, ?, NOW(), NOW())',
                        {
                            replacements: [id, role.id],
                            type: sequelize.QueryTypes.INSERT
                        }
                    );
                }
                
                logger.info('Papéis atualizados manualmente:', {
                    userId: id,
                    roles: validRoles.map(r => r.name)
                });
            } catch (error) {
                logger.error('Erro ao atualizar papéis manualmente:', error);
                throw error;
            }
        }

        // Buscar usuário atualizado com papéis
        const updatedUser = await User.findByPk(id, {
            include: [{
                model: Role,
                as: 'userRoles',
                through: { attributes: [] }
            }],
            attributes: { exclude: ['password'] }
        });

        logger.info('Usuário atualizado com sucesso:', {
            userId: id,
            username: updatedUser.username
        });

        res.json(updatedUser);
    } catch (error) {
        logger.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ 
            error: 'Erro ao atualizar usuário',
            details: error.message
        });
    }
});

// Excluir usuário
router.delete('/users/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        await user.destroy();
        res.json({ success: true });
    } catch (error) {
        logger.error('Erro ao excluir usuário:', error);
        res.status(500).json({ error: 'Erro ao excluir usuário' });
    }
});

// ===== Rotas de Papéis =====

// Listar todos os papéis
router.get('/roles', requireAdmin, async (req, res) => {
    try {
        const roles = await Role.findAll({
            include: [{
                model: Resource,
                as: 'accessibleResources',
                through: { attributes: [] }
            }],
            order: [['name', 'ASC']]
        });
        res.json(roles);
    } catch (error) {
        logger.error('Erro ao listar papéis:', error);
        res.status(500).json({ error: 'Erro ao listar papéis' });
    }
});

// Obter papel específico
router.get('/roles/:id', requireAdmin, async (req, res) => {
    try {
        const role = await Role.findByPk(req.params.id, {
            include: [{
                model: Permission,
                as: 'permissions'
            }]
        });
        
        if (!role) {
            return res.status(404).json({ error: 'Papel não encontrado' });
        }
        
        res.json(role);
    } catch (error) {
        logger.error('Erro ao buscar papel:', error);
        res.status(500).json({ error: 'Erro ao buscar papel' });
    }
});

// Criar novo papel
router.post('/roles', requireAdmin, async (req, res) => {
    try {
        const { name, description, resources } = req.body;
        
        const role = await Role.create({
            name,
            description
        });

        if (resources && resources.length > 0) {
            await role.setResources(resources);
        }

        res.json(role);
    } catch (error) {
        logger.error('Erro ao criar papel:', error);
        res.status(500).json({ error: 'Erro ao criar papel' });
    }
});

// Atualizar recursos de um papel
router.post('/roles/:id/resources', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { resources } = req.body;

        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({ error: 'Papel não encontrado' });
        }

        await role.setResources(resources);
        res.json({ success: true });
    } catch (error) {
        logger.error('Erro ao atualizar recursos:', error);
        res.status(500).json({ error: 'Erro ao atualizar recursos' });
    }
});

// ===== Rotas de Recursos =====

// Listar todos os recursos
router.get('/resources', requireAdmin, async (req, res) => {
    try {
        const resources = await Resource.findAll({
            attributes: ['id', 'name', 'path', 'description', 'type', 'icon', 'is_active', 'order', 'created_at', 'updated_at'],
            // Removendo temporariamente a associação com parent
            // include: [{
            //     model: Resource,
            //     as: 'parent',
            //     attributes: ['id', 'name'],
            //     required: false
            // }],
            order: [
                ['type', 'ASC'],
                ['order', 'ASC'],
                ['name', 'ASC']
            ]
        });
        
        res.json(resources);
    } catch (error) {
        logger.error('Erro ao listar recursos:', error);
        res.status(500).json({ 
            error: 'Erro ao listar recursos',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Obter um recurso pelo ID
router.get('/resources/:id', requireAdmin, async (req, res) => {
    try {
        const resource = await Resource.findByPk(req.params.id, {
            include: [
                // Removendo temporariamente a associação com parent
                // {
                //     model: Resource,
                //     as: 'parent',
                //     attributes: ['id', 'name']
                // },
                {
                    model: Role,
                    as: 'roles',
                    attributes: ['id', 'name'],
                    through: { attributes: [] }
                }
            ]
        });

        if (!resource) {
            return res.status(404).json({ error: 'Recurso não encontrado' });
        }

        res.json(resource);
    } catch (error) {
        logger.error(`Erro ao buscar recurso ${req.params.id}:`, error);
        res.status(500).json({ error: 'Erro ao buscar recurso' });
    }
});

// Criar novo recurso
router.post('/resources', requireAdmin, async (req, res) => {
    try {
        const {
            name, path, description, type,
            icon, is_active,
            //parent_id, // Comentando parent_id
            order
        } = req.body;

        // Verificar se o caminho já existe
        const existingPath = await Resource.findOne({ where: { path } });
        if (existingPath) {
            return res.status(400).json({
                error: 'Já existe um recurso com este caminho'
            });
        }

        // Criar o recurso
        const resource = await Resource.create({
            name,
            path,
            description,
            type: type.toUpperCase(),
            icon,
            is_active: is_active !== undefined ? is_active : true,
            //parent_id: parent_id || null, // Comentando parent_id
            order: order || 0,
            is_system: false // Recursos criados pelo admin não são do sistema por padrão
        });

        // Retornar o recurso criado
        const createdResource = await Resource.findByPk(resource.id, {
            include: [
                // Removendo temporariamente a associação com parent
                // {
                //     model: Resource,
                //     as: 'parent',
                //     attributes: ['id', 'name']
                // }
            ]
        });

        res.status(201).json(createdResource);
    } catch (error) {
        logger.error('Erro ao criar recurso:', error);
        res.status(500).json({ error: 'Erro ao criar recurso' });
    }
});

// Atualizar recurso existente
router.put('/resources/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, path, description, type,
            icon, is_active, 
            //parent_id, // Comentando parent_id
            order, is_system
        } = req.body;

        // Verificar se o recurso existe
        const resource = await Resource.findByPk(id);
        if (!resource) {
            return res.status(404).json({ error: 'Recurso não encontrado' });
        }

        // Verificar se o caminho já existe e não pertence a este recurso
        if (path && path !== resource.path) {
            const existingPath = await Resource.findOne({
                where: {
                    path,
                    id: { [Op.ne]: id }
                }
            });

            if (existingPath) {
                return res.status(400).json({
                    error: 'Já existe um recurso com este caminho'
                });
            }
        }

        // Atualizar o recurso
        await resource.update({
            name,
            path,
            description,
            type: type ? type.toUpperCase() : resource.type,
            icon,
            is_active: is_active !== undefined ? is_active : resource.is_active,
            //parent_id: parent_id !== undefined ? parent_id : resource.parent_id, // Comentando parent_id
            order: order !== undefined ? order : resource.order,
            is_system: is_system !== undefined ? is_system : resource.is_system
        });

        // Buscar o recurso atualizado
        const updatedResource = await Resource.findByPk(id, {
            include: [
                // Removendo temporariamente a associação com parent
                // {
                //     model: Resource,
                //     as: 'parent',
                //     attributes: ['id', 'name']
                // }
            ]
        });

        res.json(updatedResource);
    } catch (error) {
        logger.error(`Erro ao atualizar recurso ${req.params.id}:`, error);
        res.status(500).json({ error: 'Erro ao atualizar recurso' });
    }
});

// Excluir um recurso
router.delete('/resources/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar se o recurso existe
        const resource = await Resource.findByPk(id);
        if (!resource) {
            return res.status(404).json({ error: 'Recurso não encontrado' });
        }

        // Verificar se é um recurso do sistema
        if (resource.is_system) {
            return res.status(403).json({
                error: 'Não é possível excluir um recurso do sistema'
            });
        }

        // Excluir o recurso
        await resource.destroy();

        res.json({ success: true, message: 'Recurso excluído com sucesso' });
    } catch (error) {
        logger.error(`Erro ao excluir recurso ${req.params.id}:`, error);
        res.status(500).json({ error: 'Erro ao excluir recurso' });
    }
});

module.exports = router; 