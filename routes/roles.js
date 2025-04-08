'use strict';

const express = require('express');
const router = express.Router();
const { Role, Resource, User } = require('../models/postgresql/associations');
const { requireAdmin } = require('../middlewares/access-control');
const logger = require('../utils/logger');

// Listar todos os papéis
router.get('/', requireAdmin, async (req, res) => {
    try {
        const roles = await Role.findAll({
            include: [{
                model: Resource,
                as: 'accessibleResources'
            }]
        });
        
        logger.info(`Listando ${roles.length} papéis`);
        res.json(roles);
    } catch (error) {
        logger.error('Erro ao listar papéis:', error);
        res.status(500).json({ error: 'Erro ao listar papéis' });
    }
});

// Rota compatibilidade - Listar todos os papéis
router.get('/list', requireAdmin, async (req, res) => {
    try {
        const roles = await Role.findAll({
            include: [{
                model: Resource,
                as: 'accessibleResources'
            }]
        });
        
        logger.info(`Listando ${roles.length} papéis (rota legacy)`);
        res.json(roles);
    } catch (error) {
        logger.error('Erro ao listar papéis:', error);
        res.status(500).json({ error: 'Erro ao listar papéis' });
    }
});

// Obter papel específico com seus recursos
router.get('/:id', requireAdmin, async (req, res) => {
    try {
        const role = await Role.findByPk(req.params.id, {
            include: [{
                model: Resource,
                as: 'accessibleResources'
            }]
        });
        
        if (!role) {
            return res.status(404).json({ error: 'Papel não encontrado' });
        }
        
        logger.info(`Obtendo papel: ${role.name}`);
        res.json(role);
    } catch (error) {
        logger.error('Erro ao buscar papel:', error);
        res.status(500).json({ error: 'Erro ao buscar papel' });
    }
});

// Obter recursos de um papel específico
router.get('/:id/resources', requireAdmin, async (req, res) => {
    try {
        const role = await Role.findByPk(req.params.id, {
            include: [{
                model: Resource,
                as: 'accessibleResources'
            }]
        });
        
        if (!role) {
            return res.status(404).json({ error: 'Papel não encontrado' });
        }
        
        // Obter todos os recursos do sistema
        const allResources = await Resource.findAll();
        
        // Filtrar recursos já atribuídos
        const assignedResources = role.accessibleResources;
        const assignedResourceIds = assignedResources.map(r => r.id);
        
        // Recursos disponíveis (não atribuídos)
        const availableResources = allResources.filter(r => !assignedResourceIds.includes(r.id));
        
        logger.info(`Obtendo recursos para papel ${role.name}: ${assignedResources.length} atribuídos, ${availableResources.length} disponíveis`);
        
        res.json({
            assignedResources,
            availableResources
        });
    } catch (error) {
        logger.error('Erro ao buscar recursos do papel:', error);
        res.status(500).json({ error: 'Erro ao buscar recursos do papel' });
    }
});

// Criar novo papel
router.post('/', requireAdmin, async (req, res) => {
    try {
        const { name, description } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Nome do papel é obrigatório' });
        }
        
        // Verificar se já existe papel com este nome
        const existingRole = await Role.findOne({ where: { name } });
        if (existingRole) {
            return res.status(400).json({ error: 'Já existe um papel com este nome' });
        }
        
        const role = await Role.create({
            name,
            description
        });
        
        logger.info(`Papel criado: ${role.name}`);
        res.status(201).json(role);
    } catch (error) {
        logger.error('Erro ao criar papel:', error);
        res.status(500).json({ error: 'Erro ao criar papel' });
    }
});

// Rota compatibilidade - Criar novo papel
router.post('/create', requireAdmin, async (req, res) => {
    try {
        const { name, description } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Nome do papel é obrigatório' });
        }
        
        // Verificar se já existe papel com este nome
        const existingRole = await Role.findOne({ where: { name } });
        if (existingRole) {
            return res.status(400).json({ error: 'Já existe um papel com este nome' });
        }
        
        const role = await Role.create({
            name,
            description
        });
        
        logger.info(`Papel criado (rota legacy): ${role.name}`);
        res.status(201).json(role);
    } catch (error) {
        logger.error('Erro ao criar papel:', error);
        res.status(500).json({ error: 'Erro ao criar papel' });
    }
});

// Atualizar papel
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const { name, description } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Nome do papel é obrigatório' });
        }
        
        const role = await Role.findByPk(req.params.id);
        
        if (!role) {
            return res.status(404).json({ error: 'Papel não encontrado' });
        }
        
        // Verificar se já existe outro papel com este nome
        if (name !== role.name) {
            const existingRole = await Role.findOne({ where: { name } });
            if (existingRole) {
                return res.status(400).json({ error: 'Já existe um papel com este nome' });
            }
        }
        
        await role.update({
            name,
            description
        });
        
        logger.info(`Papel atualizado: ${role.name}`);
        res.json(role);
    } catch (error) {
        logger.error('Erro ao atualizar papel:', error);
        res.status(500).json({ error: 'Erro ao atualizar papel' });
    }
});

// Excluir papel
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const role = await Role.findByPk(req.params.id);
        
        if (!role) {
            return res.status(404).json({ error: 'Papel não encontrado' });
        }
        
        // Verificar se é o papel de admin
        if (role.name.toLowerCase() === 'admin') {
            return res.status(403).json({ error: 'Não é permitido excluir o papel de administrador' });
        }
        
        await role.destroy();
        
        logger.info(`Papel excluído: ${role.name}`);
        res.json({ message: 'Papel excluído com sucesso' });
    } catch (error) {
        logger.error('Erro ao excluir papel:', error);
        res.status(500).json({ error: 'Erro ao excluir papel' });
    }
});

// Adicionar recurso a um papel
router.post('/:roleId/resources/:resourceId', requireAdmin, async (req, res) => {
    try {
        const { roleId, resourceId } = req.params;
        
        const role = await Role.findByPk(roleId, {
            include: [{
                model: Resource,
                as: 'accessibleResources'
            }]
        });
        
        if (!role) {
            return res.status(404).json({ error: 'Papel não encontrado' });
        }
        
        const resource = await Resource.findByPk(resourceId);
        
        if (!resource) {
            return res.status(404).json({ error: 'Recurso não encontrado' });
        }
        
        // Verificar se o recurso já está associado ao papel
        const isAlreadyAssociated = role.accessibleResources.some(r => r.id === resourceId);
        
        if (isAlreadyAssociated) {
            return res.status(400).json({ error: 'Recurso já está associado a este papel' });
        }
        
        // Adicionar recurso ao papel
        await role.addAccessibleResource(resource);
        
        // Buscar papel atualizado com recursos
        const updatedRole = await Role.findByPk(roleId, {
            include: [{
                model: Resource,
                as: 'accessibleResources'
            }]
        });
        
        logger.info(`Recurso ${resource.name} adicionado ao papel ${role.name}`);
        res.json(updatedRole);
    } catch (error) {
        logger.error('Erro ao adicionar recurso ao papel:', error);
        res.status(500).json({ error: 'Erro ao adicionar recurso ao papel' });
    }
});

// Remover recurso de um papel
router.delete('/:roleId/resources/:resourceId', requireAdmin, async (req, res) => {
    try {
        const { roleId, resourceId } = req.params;
        
        const role = await Role.findByPk(roleId);
        
        if (!role) {
            return res.status(404).json({ error: 'Papel não encontrado' });
        }
        
        const resource = await Resource.findByPk(resourceId);
        
        if (!resource) {
            return res.status(404).json({ error: 'Recurso não encontrado' });
        }
        
        // Remover recurso do papel
        await role.removeAccessibleResource(resource);
        
        // Buscar papel atualizado com recursos
        const updatedRole = await Role.findByPk(roleId, {
            include: [{
                model: Resource,
                as: 'accessibleResources'
            }]
        });
        
        logger.info(`Recurso ${resource.name} removido do papel ${role.name}`);
        res.json(updatedRole);
    } catch (error) {
        logger.error('Erro ao remover recurso do papel:', error);
        res.status(500).json({ error: 'Erro ao remover recurso do papel' });
    }
});

// Adicionar usuário ao papel
router.post('/:roleId/users/:userId', requireAdmin, async (req, res) => {
    const { roleId, userId } = req.params;
    
    try {
        const role = await Role.findByPk(roleId);
        
        if (!role) {
            return res.status(404).json({ error: 'Papel não encontrado' });
        }
        
        const user = await User.findByPk(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        await role.addUser(user);
        
        res.json({ success: true });
    } catch (error) {
        logger.error('Erro ao adicionar usuário ao papel:', error);
        res.status(500).json({ error: 'Erro ao adicionar usuário ao papel' });
    }
});

// Remover usuário do papel
router.delete('/:roleId/users/:userId', requireAdmin, async (req, res) => {
    const { roleId, userId } = req.params;
    
    try {
        const role = await Role.findByPk(roleId);
        
        if (!role) {
            return res.status(404).json({ error: 'Papel não encontrado' });
        }
        
        const user = await User.findByPk(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        await role.removeUser(user);
        
        res.json({ success: true });
    } catch (error) {
        logger.error('Erro ao remover usuário do papel:', error);
        res.status(500).json({ error: 'Erro ao remover usuário do papel' });
    }
});

module.exports = router; 