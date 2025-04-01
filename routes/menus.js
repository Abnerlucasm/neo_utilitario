const express = require('express');
const router = express.Router();
const { Menu } = require('../models/postgresql/associations');
const { requireAuth, requireAdmin } = require('../middlewares/access-control');
const logger = require('../utils/logger');

// Listar todos os menus
router.get('/', async (req, res) => {
    try {
        const menus = await Menu.findAll({
            where: { isActive: true },
            order: [
                ['order', 'ASC'],
                ['title', 'ASC']
            ],
            include: [{
                model: Menu,
                as: 'children',
                where: { isActive: true },
                required: false,
                order: [
                    ['order', 'ASC'],
                    ['title', 'ASC']
                ]
            }]
        });
        
        // Filtrar apenas menus de nível superior (sem parentId)
        const rootMenus = menus.filter(menu => !menu.parentId);
        
        res.json(rootMenus);
    } catch (error) {
        logger.error('Erro ao listar menus:', error);
        res.status(500).json({ error: 'Erro ao listar menus' });
    }
});

// Obter menu específico
router.get('/:id', async (req, res) => {
    try {
        const menu = await Menu.findByPk(req.params.id, {
            include: [{
                model: Menu,
                as: 'children',
                where: { isActive: true },
                required: false,
                order: [
                    ['order', 'ASC'],
                    ['title', 'ASC']
                ]
            }]
        });
        
        if (!menu) {
            return res.status(404).json({ error: 'Menu não encontrado' });
        }
        
        res.json(menu);
    } catch (error) {
        logger.error('Erro ao buscar menu:', error);
        res.status(500).json({ error: 'Erro ao buscar menu' });
    }
});

// Criar novo menu
router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { title, path, icon, order, parentId, isAdminOnly, resourcePath } = req.body;
        
        if (!title || !path) {
            return res.status(400).json({ error: 'Título e caminho são obrigatórios' });
        }
        
        // Verificar se o menu pai existe, se fornecido
        if (parentId) {
            const parentMenu = await Menu.findByPk(parentId);
            if (!parentMenu) {
                return res.status(400).json({ error: 'Menu pai não encontrado' });
            }
        }
        
        const menu = await Menu.create({
            title,
            path,
            icon: icon || 'fas fa-link',
            order: order || 0,
            parentId: parentId || null,
            isAdminOnly: isAdminOnly || false,
            resourcePath: resourcePath || path
        });
        
        logger.info(`Menu criado: ${menu.title}`);
        res.status(201).json(menu);
    } catch (error) {
        logger.error('Erro ao criar menu:', error);
        res.status(500).json({ error: 'Erro ao criar menu' });
    }
});

// Atualizar menu
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { title, path, icon, order, parentId, isAdminOnly, isActive, resourcePath } = req.body;
        
        const menu = await Menu.findByPk(req.params.id);
        
        if (!menu) {
            return res.status(404).json({ error: 'Menu não encontrado' });
        }
        
        // Verificar se o menu pai existe, se fornecido
        if (parentId && parentId !== menu.parentId) {
            const parentMenu = await Menu.findByPk(parentId);
            if (!parentMenu) {
                return res.status(400).json({ error: 'Menu pai não encontrado' });
            }
            
            // Evitar ciclos: um menu não pode ser pai de si mesmo ou de seus ancestrais
            if (parentId === menu.id) {
                return res.status(400).json({ error: 'Um menu não pode ser pai de si mesmo' });
            }
        }
        
        await menu.update({
            title: title || menu.title,
            path: path || menu.path,
            icon: icon || menu.icon,
            order: order !== undefined ? order : menu.order,
            parentId: parentId !== undefined ? parentId : menu.parentId,
            isAdminOnly: isAdminOnly !== undefined ? isAdminOnly : menu.isAdminOnly,
            isActive: isActive !== undefined ? isActive : menu.isActive,
            resourcePath: resourcePath || menu.resourcePath
        });
        
        logger.info(`Menu atualizado: ${menu.title}`);
        res.json(menu);
    } catch (error) {
        logger.error('Erro ao atualizar menu:', error);
        res.status(500).json({ error: 'Erro ao atualizar menu' });
    }
});

// Excluir menu
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const menu = await Menu.findByPk(req.params.id);
        
        if (!menu) {
            return res.status(404).json({ error: 'Menu não encontrado' });
        }
        
        // Verificar se existem submenus
        const submenus = await Menu.findAll({ where: { parentId: menu.id } });
        if (submenus.length > 0) {
            return res.status(400).json({ 
                error: 'Não é possível excluir um menu que possui submenus',
                message: 'Remova ou reatribua os submenus antes de excluir este menu'
            });
        }
        
        await menu.destroy();
        
        logger.info(`Menu excluído: ${menu.title}`);
        res.json({ message: 'Menu excluído com sucesso' });
    } catch (error) {
        logger.error('Erro ao excluir menu:', error);
        res.status(500).json({ error: 'Erro ao excluir menu' });
    }
});

module.exports = router; 