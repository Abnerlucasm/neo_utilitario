const express = require('express');
const router = express.Router();
const { Menu, Resource } = require('../models/postgresql/associations');
const { requireAuth, requireAdmin } = require('../middlewares/access-control');
const logger = require('../utils/logger');
const { sequelize } = require('../models/postgresql/associations');

// Listar todos os menus
router.get('/', async (req, res) => {
    try {
        logger.info('Iniciando busca de menus');
        await sequelize.authenticate();
        const menus = await Menu.findAll({
            order: [
                ['order', 'ASC'],
                ['title', 'ASC']
            ],
            include: [
                {
                    model: Menu,
                    as: 'children',
                    required: false,
                    order: [
                        ['order', 'ASC'],
                        ['title', 'ASC']
                    ]
                },
                {
                    model: Resource,
                    as: 'resource',
                    required: false
                }
            ]
        });

        // Organizar menus em árvore
        const menuMap = {};
        menus.forEach(menu => {
            menuMap[menu.id] = menu.toJSON();
            menuMap[menu.id].children = [];
        });
        const tree = [];
        menus.forEach(menu => {
            if (menu.parent_id && menuMap[menu.parent_id]) {
                menuMap[menu.parent_id].children.push(menuMap[menu.id]);
            } else {
                tree.push(menuMap[menu.id]);
            }
        });

        res.json(tree);
    } catch (error) {
        logger.error('Erro ao listar menus:', error.message, error.stack);
        res.status(500).json({ error: 'Erro ao listar menus', details: error.message });
    }
});

// Obter menu específico
router.get('/:id', async (req, res) => {
    try {
        const menu = await Menu.findByPk(req.params.id, {
            include: [
                {
                    model: Menu,
                    as: 'children',
                    required: false,
                    order: [
                        ['order', 'ASC'],
                        ['title', 'ASC']
                    ]
                },
                {
                    model: Resource,
                    as: 'resource',
                    required: false
                }
            ]
        });
        if (!menu) return res.status(404).json({ error: 'Menu não encontrado' });
        res.json(menu);
    } catch (error) {
        logger.error('Erro ao buscar menu:', error.message, error.stack);
        res.status(500).json({ error: 'Erro ao buscar menu', details: error.message });
    }
});

// Criar novo menu
router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { title, path, icon, order, parent_id, is_admin_only, is_active, resource_path, resource_id } = req.body;
        if (!title || !path) {
            return res.status(400).json({ error: 'Título e caminho são obrigatórios' });
        }
        if (parent_id) {
            const parentMenu = await Menu.findByPk(parent_id);
            if (!parentMenu) return res.status(400).json({ error: 'Menu pai não encontrado' });
        }
        let resourcePathFinal = resource_path;
        if (!resourcePathFinal && resource_id) {
            const resource = await Resource.findByPk(resource_id);
            if (resource) resourcePathFinal = resource.path;
        }
        const menu = await Menu.create({
            title,
            path,
            icon: icon || 'fas fa-link',
            order: order || 0,
            parent_id: parent_id || null,
            is_admin_only: is_admin_only || false,
            is_active: is_active !== undefined ? is_active : true,
            resource_path: resourcePathFinal || path,
            resource_id: resource_id || null
        });
        res.status(201).json(menu);
    } catch (error) {
        logger.error('Erro ao criar menu:', error.message, error.stack);
        res.status(500).json({ error: 'Erro ao criar menu', details: error.message });
    }
});

// Atualizar menu
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const menuId = req.params.id;
        const menu = await Menu.findByPk(menuId);
        if (!menu) return res.status(404).json({ error: 'Menu não encontrado' });
        const { title, path, icon, order, parent_id, is_admin_only, is_active, resource_path, resource_id } = req.body;
        if (title === undefined || title === '') return res.status(400).json({ error: 'O título do menu não pode ser vazio' });
        if (path === undefined || path === '') return res.status(400).json({ error: 'O caminho (path) do menu não pode ser vazio' });
        if (parent_id && parent_id === menuId) return res.status(400).json({ error: 'Um menu não pode ser pai de si mesmo' });
        if (parent_id) {
            const parentMenu = await Menu.findByPk(parent_id);
            if (!parentMenu) return res.status(400).json({ error: 'Menu pai não encontrado' });
        }
        let resourcePathFinal = resource_path;
        if (!resourcePathFinal && resource_id) {
            const resource = await Resource.findByPk(resource_id);
            if (resource) resourcePathFinal = resource.path;
        }
        const updateData = {
            title,
            path,
            icon: icon || 'fas fa-link',
            order: order || 0,
            parent_id: parent_id || null,
            is_admin_only: is_admin_only || false,
            is_active: is_active !== undefined ? is_active : true,
            resource_path: resourcePathFinal || path,
            resource_id: resource_id || null
        };
        await menu.update(updateData);
        await menu.reload();
        res.json(menu);
    } catch (error) {
        logger.error('Erro ao atualizar menu:', error.message, error.stack);
        res.status(500).json({ error: 'Erro ao atualizar menu', details: error.message });
    }
});

// Excluir menu
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const menu = await Menu.findByPk(req.params.id);
        if (!menu) return res.status(404).json({ error: 'Menu não encontrado' });
        const submenus = await Menu.findAll({ where: { parent_id: menu.id } });
        if (submenus.length > 0) {
            return res.status(400).json({ error: 'Não é possível excluir um menu que possui submenus', message: 'Remova ou reatribua os submenus antes de excluir este menu' });
        }
        await menu.destroy();
        res.json({ message: 'Menu excluído com sucesso' });
    } catch (error) {
        logger.error('Erro ao excluir menu:', error);
        res.status(500).json({ error: 'Erro ao excluir menu' });
    }
});

module.exports = router;