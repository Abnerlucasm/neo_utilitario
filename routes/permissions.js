const express = require('express');
const router = express.Router();
const { Permission } = require('../models/postgresql/associations');
const { requireAuth } = require('../middlewares/access-control');
const logger = require('../utils/logger');

/**
 * GET /api/permissions
 * Lista todas as permissões
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        logger.info('Listando permissões', { userId: req.user.id, username: req.user.username });
        
        const permissions = await Permission.findAll({
            order: [['name', 'ASC']],
            attributes: ['id', 'name', 'description', 'resource', 'action', 'createdAt', 'updatedAt']
        });
        
        logger.info(`Encontradas ${permissions.length} permissões`);
        
        res.json(permissions);
    } catch (error) {
        logger.error('Erro ao listar permissões:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

/**
 * GET /api/permissions/:id
 * Obtém uma permissão específica
 */
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const permission = await Permission.findByPk(id);
        
        if (!permission) {
            return res.status(404).json({ error: 'Permissão não encontrada' });
        }
        
        res.json(permission);
    } catch (error) {
        logger.error('Erro ao buscar permissão:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

/**
 * POST /api/permissions
 * Cria uma nova permissão
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const { name, description, resource, action, isActive = true } = req.body;
        
        // Validar campos obrigatórios
        if (!name || !resource || !action) {
            return res.status(400).json({ error: 'Nome, recurso e ação são obrigatórios' });
        }
        
        // Verificar se já existe uma permissão com o mesmo nome
        const existingPermission = await Permission.findOne({ where: { name } });
        if (existingPermission) {
            return res.status(400).json({ error: 'Já existe uma permissão com este nome' });
        }
        
        const permission = await Permission.create({
            name,
            description,
            resource,
            action,
            isActive
        });
        
        logger.info('Permissão criada com sucesso', { 
            permissionId: permission.id, 
            userId: req.user.id, 
            username: req.user.username 
        });
        
        res.status(201).json(permission);
    } catch (error) {
        logger.error('Erro ao criar permissão:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

/**
 * PUT /api/permissions/:id
 * Atualiza uma permissão
 */
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, resource, action, isActive } = req.body;
        
        const permission = await Permission.findByPk(id);
        
        if (!permission) {
            return res.status(404).json({ error: 'Permissão não encontrada' });
        }
        
        // Verificar se já existe outra permissão com o mesmo nome
        if (name && name !== permission.name) {
            const existingPermission = await Permission.findOne({ where: { name } });
            if (existingPermission) {
                return res.status(400).json({ error: 'Já existe uma permissão com este nome' });
            }
        }
        
        await permission.update({
            name: name || permission.name,
            description: description !== undefined ? description : permission.description,
            resource: resource || permission.resource,
            action: action || permission.action,
            isActive: isActive !== undefined ? isActive : permission.isActive
        });
        
        logger.info('Permissão atualizada com sucesso', { 
            permissionId: permission.id, 
            userId: req.user.id, 
            username: req.user.username 
        });
        
        res.json(permission);
    } catch (error) {
        logger.error('Erro ao atualizar permissão:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

/**
 * DELETE /api/permissions/:id
 * Remove uma permissão
 */
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const permission = await Permission.findByPk(id);
        
        if (!permission) {
            return res.status(404).json({ error: 'Permissão não encontrada' });
        }
        
        await permission.destroy();
        
        logger.info('Permissão removida com sucesso', { 
            permissionId: id, 
            userId: req.user.id, 
            username: req.user.username 
        });
        
        res.json({ message: 'Permissão removida com sucesso' });
    } catch (error) {
        logger.error('Erro ao remover permissão:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router; 