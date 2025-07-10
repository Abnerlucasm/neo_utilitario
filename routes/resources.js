const express = require('express');
const router = express.Router();
    const { Resource, Role, Menu } = require('../models/postgresql/associations');
const { requireAuth, requireAdmin } = require('../middlewares/access-control');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * @route GET /api/resources/debug
 * @desc Rota de debug para testar recursos sem autenticação
 * @access Public (temporário)
 */
router.get('/debug', async (req, res) => {
    try {
        logger.info('Testando API de recursos (debug)...');
        
        const resources = await Resource.findAll({
            attributes: ['id', 'name', 'path', 'type', 'is_active'],
            limit: 5
        });

        logger.info(`Recursos encontrados: ${resources.length}`);
        
        return res.json({ 
            success: true, 
            data: resources,
            count: resources.length
        });
    } catch (error) {
        logger.error('Erro ao buscar recursos (debug):', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Erro ao buscar recursos',
            error: error.message,
            stack: error.stack
        });
    }
});

/**
 * @route GET /api/resources
 * @desc Obter todos os recursos com filtros
 * @access Private (Admin) - Temporariamente público para debug
 */
router.get('/', async (req, res) => {
    try {
        const { 
            type, 
            is_active, 
            search, 
            parent_id,
            include_roles = false,
            include_children = false
        } = req.query;

        // Construir where clause
        const whereClause = {};
        
        if (type) {
            // Tratar múltiplos tipos separados por vírgula
            if (type.includes(',')) {
                const types = type.split(',').map(t => t.trim());
                whereClause.type = { [Op.in]: types };
            } else {
                whereClause.type = type;
            }
        }
        
        if (is_active !== undefined) {
            whereClause.is_active = is_active === 'true';
        }
        
        if (parent_id) {
            whereClause.parent_id = parent_id === 'null' ? null : parent_id;
        }
        
        if (search) {
            whereClause[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { path: { [Op.iLike]: `%${search}%` } },
                { description: { [Op.iLike]: `%${search}%` } }
            ];
        }

        // Construir include clause
        const includeClause = [];
        
        if (include_roles === 'true') {
            includeClause.push({
                model: Role,
                as: 'roles',
                attributes: ['id', 'name', 'description'],
                where: { is_active: true },
                through: { attributes: [] }
            });
        }
        
        if (include_children === 'true') {
            includeClause.push({
                model: Resource,
                as: 'children',
                attributes: ['id', 'name', 'path', 'type', 'icon', 'is_active', 'order'],
                where: { is_active: true },
                order: [['order', 'ASC'], ['name', 'ASC']]
            });
        }

        const resources = await Resource.findAll({
            where: whereClause,
            attributes: [
                'id', 'name', 'path', 'description', 'type', 'icon', 
                'is_active', 'is_admin_only', 'is_system', 'order', 
                'parent_id', 'created_at', 'updated_at'
            ],
            include: includeClause,
            order: [
                ['type', 'ASC'],
                ['order', 'ASC'],
                ['name', 'ASC']
            ]
        });

        logger.info(`Recursos encontrados: ${resources.length}`, { 
            userId: req.user?.id || 'debug', 
            filters: req.query 
        });

        return res.json({ 
            success: true, 
            data: resources,
            count: resources.length
        });
    } catch (error) {
        logger.error('Erro ao buscar recursos:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Erro ao buscar recursos',
            error: error.message
        });
    }
});

/**
 * @route GET /api/resources/tree
 * @desc Obter recursos em formato de árvore
 * @access Private (Admin)
 */
router.get('/tree', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { include_inactive = false } = req.query;
        
        // Buscar recursos principais (sem parent)
        const whereClause = { parent_id: null };
        if (include_inactive !== 'true') {
            whereClause.is_active = true;
        }

        const rootResources = await Resource.findAll({
            where: whereClause,
            include: [
                {
                    model: Role,
                    as: 'roles',
                    attributes: ['id', 'name'],
                    through: { attributes: [] }
                }
            ],
            order: [['order', 'ASC'], ['name', 'ASC']]
        });

        // Construir árvore de recursos
        const resourceTree = [];
        for (const resource of rootResources) {
            const resourceData = resource.toJSON();
            resourceData.children = await resource.getResourceTree();
            resourceTree.push(resourceData);
        }

        logger.info(`Árvore de recursos construída com ${resourceTree.length} raízes`, { 
            userId: req.user.id 
        });

        return res.json({ 
            success: true, 
            data: resourceTree 
        });
    } catch (error) {
        logger.error('Erro ao buscar árvore de recursos:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Erro ao buscar árvore de recursos',
            error: error.message
        });
    }
});

/**
 * @route GET /api/resources/:id
 * @desc Obter um recurso pelo ID
 * @access Private (Admin)
 */
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const resource = await Resource.findByPk(req.params.id, {
            include: [
                {
                    model: Resource,
                    as: 'parent',
                    attributes: ['id', 'name', 'path']
                },
                {
                    model: Resource,
                    as: 'children',
                    attributes: ['id', 'name', 'path', 'type', 'icon', 'is_active', 'order'],
                    where: { is_active: true },
                    order: [['order', 'ASC'], ['name', 'ASC']]
                },
                {
                    model: Role,
                    as: 'roles',
                    attributes: ['id', 'name', 'description'],
                    through: { attributes: [] }
                },
                {
                    model: Menu,
                    as: 'menu',
                    attributes: ['id', 'title', 'path']
                }
            ]
        });

        if (!resource) {
            return res.status(404).json({ 
                success: false, 
                message: 'Recurso não encontrado' 
            });
        }

        logger.info(`Recurso ${req.params.id} consultado`, { 
            userId: req.user.id 
        });

        return res.json({ 
            success: true, 
            data: resource 
        });
    } catch (error) {
        logger.error(`Erro ao buscar recurso ${req.params.id}:`, error);
        return res.status(500).json({ 
            success: false, 
            message: 'Erro ao buscar recurso',
            error: error.message
        });
    }
});

/**
 * @route POST /api/resources
 * @desc Criar um novo recurso
 * @access Private (Admin)
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { 
            name, path, description, type, 
            icon, is_active, parent_id, order, 
            roles, is_admin_only, metadata
        } = req.body;

        // Verificar se o caminho já existe
        const existingPath = await Resource.findOne({ where: { path } });
        if (existingPath) {
            return res.status(400).json({ 
                success: false, 
                message: 'Já existe um recurso com este caminho' 
            });
        }

        // Validar parent_id se fornecido
        if (parent_id) {
            const parent = await Resource.findByPk(parent_id);
            if (!parent) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Recurso pai não encontrado' 
                });
            }
        }

        // Criar o recurso
        const resource = await Resource.create({
            name,
            path,
            description,
            type,
            icon,
            is_active: is_active !== undefined ? is_active : true,
            is_admin_only: is_admin_only || false,
            parent_id: parent_id || null,
            order: order || 0,
            metadata: metadata || {}
        });

        // Associar aos papéis se fornecidos
        if (roles && Array.isArray(roles) && roles.length > 0) {
            const roleObjects = await Role.findAll({
                where: { id: { [Op.in]: roles } }
            });
            
            if (roleObjects.length > 0) {
                await resource.setRoles(roleObjects);
            }
        }

        // Retornar o recurso criado com relacionamentos
        const createdResource = await Resource.findByPk(resource.id, {
            include: [
                {
                    model: Resource,
                    as: 'parent',
                    attributes: ['id', 'name']
                },
                {
                    model: Role,
                    as: 'roles',
                    attributes: ['id', 'name'],
                    through: { attributes: [] }
                }
            ]
        });

        logger.info(`Recurso criado: ${resource.name}`, { 
            userId: req.user.id,
            resourceId: resource.id 
        });

        return res.status(201).json({ 
            success: true, 
            message: 'Recurso criado com sucesso',
            data: createdResource
        });
    } catch (error) {
        logger.error('Erro ao criar recurso:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Erro ao criar recurso',
            error: error.message
        });
    }
});

/**
 * @route PUT /api/resources/:id
 * @desc Atualizar um recurso
 * @access Private (Admin)
 */
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const resource = await Resource.findByPk(req.params.id);
        
        if (!resource) {
            return res.status(404).json({ 
                success: false, 
                message: 'Recurso não encontrado' 
            });
        }

        const { 
            name, path, description, type, 
            icon, is_active, parent_id, order, 
            roles, is_admin_only, metadata
        } = req.body;

        // Verificar se o caminho já existe (exceto para o próprio recurso)
        if (path && path !== resource.path) {
            const existingPath = await Resource.findOne({ 
                where: { path, id: { [Op.ne]: req.params.id } } 
            });
            if (existingPath) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Já existe um recurso com este caminho' 
                });
            }
        }

        // Validar parent_id se fornecido
        if (parent_id && parent_id !== resource.parent_id) {
            if (parent_id === req.params.id) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Um recurso não pode ser pai de si mesmo' 
                });
            }
            
            const parent = await Resource.findByPk(parent_id);
            if (!parent) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Recurso pai não encontrado' 
                });
            }
        }

        // Atualizar o recurso
        await resource.update({
            name: name || resource.name,
            path: path || resource.path,
            description: description !== undefined ? description : resource.description,
            type: type || resource.type,
            icon: icon !== undefined ? icon : resource.icon,
            is_active: is_active !== undefined ? is_active : resource.is_active,
            is_admin_only: is_admin_only !== undefined ? is_admin_only : resource.is_admin_only,
            parent_id: parent_id !== undefined ? parent_id : resource.parent_id,
            order: order !== undefined ? order : resource.order,
            metadata: metadata || resource.metadata
        });

        // Atualizar papéis se fornecidos
        if (roles !== undefined) {
            if (Array.isArray(roles) && roles.length > 0) {
                const roleObjects = await Role.findAll({
                    where: { id: { [Op.in]: roles } }
                });
                await resource.setRoles(roleObjects);
            } else {
                await resource.setRoles([]);
            }
        }

        // Retornar o recurso atualizado
        const updatedResource = await Resource.findByPk(req.params.id, {
            include: [
                {
                    model: Resource,
                    as: 'parent',
                    attributes: ['id', 'name']
                },
                {
                    model: Role,
                    as: 'roles',
                    attributes: ['id', 'name'],
                    through: { attributes: [] }
                }
            ]
        });

        logger.info(`Recurso atualizado: ${resource.name}`, { 
            userId: req.user.id,
            resourceId: resource.id 
        });

        return res.json({ 
            success: true, 
            message: 'Recurso atualizado com sucesso',
            data: updatedResource
        });
    } catch (error) {
        logger.error(`Erro ao atualizar recurso ${req.params.id}:`, error);
        return res.status(500).json({ 
            success: false, 
            message: 'Erro ao atualizar recurso',
            error: error.message
        });
    }
});

/**
 * @route DELETE /api/resources/:id
 * @desc Excluir um recurso
 * @access Private (Admin)
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const resource = await Resource.findByPk(req.params.id, {
            include: [
                {
                    model: Resource,
                    as: 'children',
                    attributes: ['id', 'name']
                }
            ]
        });
        
        if (!resource) {
            return res.status(404).json({ 
                success: false, 
                message: 'Recurso não encontrado' 
            });
        }

        // Verificar se é um recurso do sistema
        if (resource.is_system) {
            return res.status(400).json({ 
                success: false, 
                message: 'Não é possível excluir recursos do sistema' 
            });
        }

        // Verificar se tem filhos
        if (resource.children && resource.children.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Não é possível excluir um recurso que possui filhos. Remova os filhos primeiro.' 
            });
        }

        // Verificar se está sendo usado por algum menu
        const menuUsingResource = await Menu.findOne({
            where: { resource_id: req.params.id }
        });

        if (menuUsingResource) {
            return res.status(400).json({ 
                success: false, 
                message: 'Não é possível excluir um recurso que está sendo usado por um menu' 
            });
        }

        // Excluir o recurso
        await resource.destroy();

        logger.info(`Recurso excluído: ${resource.name}`, { 
            userId: req.user.id,
            resourceId: resource.id 
        });

        return res.json({ 
            success: true, 
            message: 'Recurso excluído com sucesso' 
        });
    } catch (error) {
        logger.error(`Erro ao excluir recurso ${req.params.id}:`, error);
        return res.status(500).json({ 
            success: false, 
            message: 'Erro ao excluir recurso',
            error: error.message
        });
    }
});

/**
 * @route GET /api/resources/:id/roles
 * @desc Obter papéis de um recurso
 * @access Private (Admin)
 */
router.get('/:id/roles', requireAuth, requireAdmin, async (req, res) => {
    try {
        const resource = await Resource.findByPk(req.params.id);
        
        if (!resource) {
            return res.status(404).json({ 
                success: false, 
                message: 'Recurso não encontrado' 
            });
        }

        const roles = await resource.getAccessibleRoles();

        return res.json({ 
            success: true, 
            data: roles 
        });
    } catch (error) {
        logger.error(`Erro ao buscar papéis do recurso ${req.params.id}:`, error);
        return res.status(500).json({ 
            success: false, 
            message: 'Erro ao buscar papéis do recurso',
            error: error.message
        });
    }
});

/**
 * @route POST /api/resources/:id/roles
 * @desc Associar papéis a um recurso
 * @access Private (Admin)
 */
router.post('/:id/roles', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { roles } = req.body;
        
        const resource = await Resource.findByPk(req.params.id);
        
        if (!resource) {
            return res.status(404).json({ 
                success: false, 
                message: 'Recurso não encontrado' 
            });
        }

        if (!Array.isArray(roles)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Lista de papéis deve ser um array' 
            });
        }

        const roleObjects = await Role.findAll({
            where: { id: { [Op.in]: roles } }
        });

        await resource.setRoles(roleObjects);

        logger.info(`Papéis associados ao recurso ${resource.name}`, { 
            userId: req.user.id,
            resourceId: resource.id,
            rolesCount: roleObjects.length 
        });

        return res.json({ 
            success: true, 
            message: 'Papéis associados com sucesso',
            data: roleObjects
        });
    } catch (error) {
        logger.error(`Erro ao associar papéis ao recurso ${req.params.id}:`, error);
        return res.status(500).json({ 
            success: false, 
            message: 'Erro ao associar papéis',
            error: error.message
        });
    }
});

module.exports = router; 