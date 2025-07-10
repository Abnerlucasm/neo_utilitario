const express = require('express');
const router = express.Router();
const { Resource, Role } = require('../models/postgresql/associations');
const { requireAuth, requireAdmin } = require('../middlewares/access-control');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * @route GET /api/resources
 * @desc Obter todos os recursos
 * @access Private (Admin)
 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const resources = await Resource.findAll({
            attributes: ['id', 'name', 'path', 'description', 'type', 'icon', 'is_active', 'order', 'created_at', 'updated_at'],
            order: [
                ['type', 'ASC'],
                ['order', 'ASC'],
                ['name', 'ASC']
            ]
            // Removendo temporariamente a associação com parent
            // include: [
            //    { 
            //        model: Resource, 
            //        as: 'parent',
            //        attributes: ['id', 'name'] 
            //    }
            // ]
        });

        return res.json({ success: true, data: resources });
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
 * @route GET /api/v1/resources/tree
 * @desc Obter recursos em formato de árvore
 * @access Private (Admin)
 */
router.get('/tree', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Buscar recursos principais (sem parent)
        const rootResources = await Resource.findAll({
            where: { parent_id: null },
            order: [['order', 'ASC'], ['name', 'ASC']]
        });

        // Construir árvore de recursos
        const resourceTree = [];
        for (const resource of rootResources) {
            const resourceData = resource.toJSON();
            resourceData.children = await resource.getResourceTree();
            resourceTree.push(resourceData);
        }

        return res.json({ success: true, data: resourceTree });
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
 * @route GET /api/v1/resources/:id
 * @desc Obter um recurso pelo ID
 * @access Private (Admin)
 */
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
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
            return res.status(404).json({ 
                success: false, 
                message: 'Recurso não encontrado' 
            });
        }

        return res.json({ success: true, data: resource });
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
 * @route POST /api/v1/resources
 * @desc Criar um novo recurso
 * @access Private (Admin)
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Extrair dados da requisição
        const { 
            name, path, description, type, 
            icon, is_active, 
            //parent_id, // Comentando parent_id
            order, 
            roles
        } = req.body;

        // Verificar se o caminho já existe
        const existingPath = await Resource.findOne({ where: { path } });
        if (existingPath) {
            return res.status(400).json({ 
                success: false, 
                message: 'Já existe um recurso com este caminho' 
            });
        }

        // Criar o recurso
        const resource = await Resource.create({
            name,
            path,
            description,
            type,
            icon,
            is_active: is_active !== undefined ? is_active : true,
            //parent_id: parent_id || null, // Comentando parent_id
            order: order || 0
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

        // Retornar o recurso criado
        const createdResource = await Resource.findByPk(resource.id, {
            attributes: ['id', 'name', 'path', 'description', 'type', 'icon', 'is_active', 'order', 'created_at', 'updated_at'],
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
 * @route PUT /api/v1/resources/:id
 * @desc Atualizar um recurso
 * @access Private (Admin)
 */
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Extrair dados da requisição
        const { 
            name, path, description, type, 
            icon, is_active, 
            //parent_id, // Comentando parent_id
            order, roles
        } = req.body;

        // Verificar se o recurso existe
        const resource = await Resource.findByPk(id);
        if (!resource) {
            return res.status(404).json({ 
                success: false, 
                message: 'Recurso não encontrado' 
            });
        }

        // Verificar se o caminho já existe (exceto se for o mesmo recurso)
        if (path && path !== resource.path) {
            const existingPath = await Resource.findOne({
                where: {
                    path,
                    id: { [Op.ne]: id }
                }
            });

            if (existingPath) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Já existe um recurso com este caminho' 
                });
            }
        }

        // Prevenir ciclos na hierarquia
        if (parent_id && parent_id !== resource.parent_id) {
            if (parent_id === resource.id) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Um recurso não pode ser seu próprio pai' 
                });
            }
            
            // Verificar se o novo pai não é descendente deste recurso
            // (para evitar ciclos na hierarquia)
            let checkParent = await Resource.findByPk(parent_id);
            while (checkParent && checkParent.parent_id) {
                if (checkParent.parent_id === resource.id) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Esta operação criaria um ciclo na hierarquia de recursos' 
                    });
                }
                checkParent = await Resource.findByPk(checkParent.parent_id);
            }
        }

        // Atualizar o recurso
        await resource.update({
            name: name || resource.name,
            path: path || resource.path,
            description: description !== undefined ? description : resource.description,
            type: type || resource.type,
            icon: icon || resource.icon,
            is_active: is_active !== undefined ? is_active : resource.is_active,
            //parent_id: parent_id !== undefined ? parent_id : resource.parent_id, // Comentando parent_id
            order: order !== undefined ? order : resource.order
        });

        // Atualizar associação com papéis se fornecido
        if (roles && Array.isArray(roles)) {
            const roleObjects = await Role.findAll({
                where: { id: { [Op.in]: roles } }
            });
            
            await resource.setRoles(roleObjects);
        }

        // Buscar recurso atualizado
        const updatedResource = await Resource.findByPk(id, {
            attributes: ['id', 'name', 'path', 'description', 'type', 'icon', 'is_active', 'order', 'created_at', 'updated_at'],
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
 * @route DELETE /api/v1/resources/:id
 * @desc Excluir um recurso
 * @access Private (Admin)
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar se o recurso existe
        const resource = await Resource.findByPk(id);
        if (!resource) {
            return res.status(404).json({ 
                success: false, 
                message: 'Recurso não encontrado' 
            });
        }

        // Verificar se existem recursos filhos
        const childrenCount = await Resource.count({ where: { parent_id: id } });
        if (childrenCount > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Este recurso possui recursos filhos. Remova-os primeiro.' 
            });
        }

        // Remover o recurso
        await resource.destroy();

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
 * @route GET /api/v1/resources/search
 * @desc Pesquisar recursos
 * @access Private (Admin)
 */
router.get('/search', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { term, type } = req.query;
        
        const whereClause = {};
        
        // Adicionar filtro por termo de pesquisa
        if (term) {
            whereClause[Op.or] = [
                { name: { [Op.iLike]: `%${term}%` } },
                { path: { [Op.iLike]: `%${term}%` } },
                { description: { [Op.iLike]: `%${term}%` } }
            ];
        }
        
        // Adicionar filtro por tipo
        if (type) {
            whereClause.type = type;
        }
        
        const resources = await Resource.findAll({
            attributes: ['id', 'name', 'path', 'description', 'type', 'icon', 'is_active', 'order', 'created_at', 'updated_at'],
            where: whereClause,
            order: [
                ['type', 'ASC'],
                ['order', 'ASC'],
                ['name', 'ASC']
            ]
            // Removendo temporariamente a associação com parent
            /*
            include: [
                { 
                    model: Resource, 
                    as: 'parent',
                    attributes: ['id', 'name'] 
                }
            ]
            */
        });

        return res.json({ success: true, data: resources });
    } catch (error) {
        logger.error('Erro ao pesquisar recursos:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Erro ao pesquisar recursos',
            error: error.message
        });
    }
});

module.exports = router; 