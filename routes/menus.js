const express = require('express');
const router = express.Router();
const { Menu } = require('../models/postgresql/associations');
const { requireAuth, requireAdmin } = require('../middlewares/access-control');
const logger = require('../utils/logger');
const { sequelize } = require('../models/postgresql/associations');

// Listar todos os menus
router.get('/', async (req, res) => {
    try {
        logger.info('Iniciando busca de menus');
        
        // Verificar conexão com o banco
        try {
            await sequelize.authenticate();
            logger.info('Conexão com o banco de dados estabelecida com sucesso.');
        } catch (dbError) {
            logger.error('Erro na conexão com o banco de dados:', dbError);
            return res.status(500).json({ 
                error: 'Erro na conexão com o banco de dados', 
                details: dbError.message 
            });
        }
        
        // Verificar se o modelo Menu existe
        if (!Menu) {
            logger.error('Modelo Menu não encontrado ou não definido');
            return res.status(500).json({ error: 'Modelo Menu não disponível' });
        }
        
        // Verificar se o método findAll existe
        if (typeof Menu.findAll !== 'function') {
            logger.error('Método findAll não disponível no modelo Menu');
            return res.status(500).json({ error: 'API de consulta não disponível' });
        }
        
        // Contar total de menus para diagnóstico
        try {
            const total = await Menu.count();
            logger.info(`Total de menus no banco: ${total}`);
        } catch (countError) {
            logger.error('Erro ao contar menus:', countError);
            // Continuar mesmo com erro na contagem
        }
        
        // Remover temporariamente a condição de isActive para depuração
        const menus = await Menu.findAll({
            order: [
                ['order', 'ASC'],
                ['title', 'ASC']
            ],
            include: [{
                model: Menu,
                as: 'children',
                required: false,
                order: [
                    ['order', 'ASC'],
                    ['title', 'ASC']
                ]
            }]
        });
        
        logger.info(`Encontrados ${menus.length} menus no total`);
        
        // Filtrar apenas menus de nível superior (sem parentId)
        const rootMenus = menus.filter(menu => !menu.parentId);
        logger.info(`Filtrando menus: ${rootMenus.length} menus de nível superior encontrados`);
        
        res.json(rootMenus);
    } catch (error) {
        logger.error('Erro ao listar menus:', error.message, '\nDetalhes:', error.stack);
        res.status(500).json({ 
            error: 'Erro ao listar menus', 
            details: error.message,
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
    }
});

// Obter menu específico
router.get('/:id', async (req, res) => {
    try {
        logger.info(`Buscando menu por ID: ${req.params.id}`);
        
        const menu = await Menu.findByPk(req.params.id, {
            include: [{
                model: Menu,
                as: 'children',
                required: false,
                order: [
                    ['order', 'ASC'],
                    ['title', 'ASC']
                ]
            }]
        });
        
        if (!menu) {
            logger.warn(`Menu não encontrado: ${req.params.id}`);
            return res.status(404).json({ error: 'Menu não encontrado' });
        }
        
        logger.info(`Menu encontrado: ${menu.title}`);
        res.json(menu);
    } catch (error) {
        logger.error(`Erro ao buscar menu ${req.params.id}:`, error.message, '\nDetalhes:', error.stack);
        res.status(500).json({ error: 'Erro ao buscar menu', details: error.message });
    }
});

// Criar novo menu
router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { title, path, icon, order, parentId, isAdminOnly, resourcePath } = req.body;
        
        logger.info('Recebida solicitação para criar menu:', {
            title, path, icon, order, parentId, isAdminOnly, resourcePath
        });
        
        if (!title || !path) {
            logger.warn('Tentativa de criar menu sem título ou caminho');
            return res.status(400).json({ error: 'Título e caminho são obrigatórios' });
        }
        
        // Verificar se o menu pai existe, se fornecido
        if (parentId) {
            logger.info(`Verificando menu pai: ${parentId}`);
            const parentMenu = await Menu.findByPk(parentId);
            if (!parentMenu) {
                logger.warn(`Menu pai não encontrado: ${parentId}`);
                return res.status(400).json({ error: 'Menu pai não encontrado' });
            }
            logger.info(`Menu pai encontrado: ${parentMenu.title}`);
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
        
        logger.info(`Menu criado com sucesso: ${menu.title} (ID: ${menu.id})`);
        res.status(201).json(menu);
    } catch (error) {
        logger.error('Erro ao criar menu:', error.message, '\nDetalhes:', error.stack);
        res.status(500).json({ 
            error: 'Erro ao criar menu', 
            details: error.message,
            body: req.body 
        });
    }
});

// Atualizar menu
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Extrair dados da requisição
        const menuId = req.params.id;
        
        // Verificar tipo dos dados
        logger.info(`Tentativa de atualização do menu ${menuId} - Dados:`, req.body);
        
        // Verificar conexão com o banco de dados
        try {
            await sequelize.authenticate();
            logger.info('Conexão com o banco de dados estabelecida para atualização de menu');
        } catch (dbError) {
            logger.error('Erro na conexão com o banco de dados durante atualização de menu:', dbError);
            return res.status(500).json({ 
                error: 'Erro na conexão com o banco de dados', 
                details: dbError.message 
            });
        }
        
        try {
            // Verificar se o menu existe antes de tentar atualizar
            const menuExists = await Menu.findByPk(menuId);
            if (!menuExists) {
                logger.warn(`Menu não encontrado para atualização: ${menuId}`);
                return res.status(404).json({ error: 'Menu não encontrado' });
            }

            // Validar dados mínimos para evitar problemas
            if (req.body.title === undefined || req.body.title === '') {
                logger.warn('Tentativa de atualizar menu com título vazio');
                return res.status(400).json({ error: 'O título do menu não pode ser vazio' });
            }

            if (req.body.path === undefined || req.body.path === '') {
                logger.warn('Tentativa de atualizar menu com caminho vazio');
                return res.status(400).json({ error: 'O caminho (path) do menu não pode ser vazio' });
            }

            // Validar parentId (se existir e for diferente de null)
            if (req.body.parentId && req.body.parentId !== null) {
                // Verificar se não é o próprio ID
                if (req.body.parentId === menuId) {
                    logger.warn(`Tentativa de definir menu como pai de si mesmo: ${menuId}`);
                    return res.status(400).json({ error: 'Um menu não pode ser pai de si mesmo' });
                }
                
                // Verificar se o menu pai existe
                const parentMenu = await Menu.findByPk(req.body.parentId);
            if (!parentMenu) {
                    logger.warn(`Menu pai não encontrado: ${req.body.parentId}`);
                return res.status(400).json({ error: 'Menu pai não encontrado' });
                }
            }
            
            // Preparar dados para atualização com validações
            const updateData = {};
            
            // Processar apenas campos válidos e fazer conversões necessárias
            if ('title' in req.body) updateData.title = String(req.body.title);
            if ('path' in req.body) updateData.path = String(req.body.path);
            if ('icon' in req.body) updateData.icon = String(req.body.icon || 'fas fa-link');
            
            if ('order' in req.body) {
                const orderNum = parseInt(req.body.order, 10);
                updateData.order = isNaN(orderNum) ? 0 : orderNum;
            }
            
            if ('parentId' in req.body) {
                updateData.parentId = req.body.parentId === null || req.body.parentId === '' ? null : req.body.parentId;
            }
            
            if ('isAdminOnly' in req.body) updateData.isAdminOnly = req.body.isAdminOnly === true;
            if ('isActive' in req.body) updateData.isActive = req.body.isActive === true;
            
            if ('resourcePath' in req.body) {
                if (!req.body.resourcePath) {
                    updateData.resourcePath = updateData.path || menuExists.path;
                } else {
                    updateData.resourcePath = String(req.body.resourcePath);
                }
            }
            
            logger.info(`Atualizando menu ${menuId} com dados validados:`, updateData);
            
            // Atualizar o menu diretamente sem usar updateSafely (que pode estar causando o erro)
            try {
                await menuExists.update(updateData);
                await menuExists.reload();
                
                logger.info(`Menu atualizado com sucesso: ${menuExists.title}`);
                return res.json(menuExists);
            } catch (updateError) {
                logger.error(`Erro ao atualizar menu ${menuId}:`, updateError);
                return res.status(500).json({ 
                    error: 'Erro ao atualizar menu',
                    details: updateError.message,
                    stack: process.env.NODE_ENV !== 'production' ? updateError.stack : undefined
                });
            }
        } catch (error) {
            // Mapear erros específicos para códigos HTTP apropriados
            if (error.message === 'Menu não encontrado') {
                logger.warn(`Menu não encontrado para atualização: ${menuId}`);
                return res.status(404).json({ error: error.message });
            } else if (
                error.message === 'Um menu não pode ser pai de si mesmo' || 
                error.message === 'Menu pai não encontrado'
            ) {
                logger.warn(`Validação falhou: ${error.message}`);
                return res.status(400).json({ error: error.message });
            }
            
            // Outros erros são tratados como erros de servidor
            logger.error(`Erro ao atualizar menu ${menuId}:`, error);
            return res.status(500).json({ 
                error: 'Erro ao atualizar menu',
                details: error.message,
                stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
            });
        }
    } catch (error) {
        logger.error('Erro ao processar atualização de menu:', error);
        return res.status(500).json({ 
            error: 'Erro interno do servidor',
            details: error.message,
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
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