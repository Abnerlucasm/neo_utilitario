const express = require('express');
const router = express.Router();
const { Role, Permission, User, Resource } = require('../models/postgresql/associations');
const { authenticate } = require('../middlewares/auth');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const { requireAdmin } = require('../middlewares/access-control');

// Middleware de autenticação
router.use(authenticate);

// ===== Rotas de Usuários =====

// Listar todos os usuários
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.findAll({
            include: [{
                model: Role,
                as: 'roles',
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

        // Associar papéis ao usuário
        await user.setRoles(validRoles);

        // Buscar usuário com papéis para retornar
        const createdUser = await User.findByPk(user.id, {
            include: [{
                model: Role,
                as: 'roles',
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

            await user.setRoles(validRoles);
            logger.info('Papéis atualizados:', {
                userId: id,
                roles: validRoles.map(r => r.name)
            });
        }

        // Buscar usuário atualizado com papéis
        const updatedUser = await User.findByPk(id, {
            include: [{
                model: Role,
                as: 'roles',
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
                as: 'resources',
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
            order: [['name', 'ASC']]
        });
        res.json(resources);
    } catch (error) {
        logger.error('Erro ao listar recursos:', error);
        res.status(500).json({ error: 'Erro ao listar recursos' });
    }
});

module.exports = router; 