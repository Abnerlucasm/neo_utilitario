const { sequelize, Menu, Resource } = require('../models/postgresql/associations');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Cria recursos recursivamente com hierarquia baseada nos menus
 */
async function createResourcesFromMenus(menus, parentResourceId = null, menuIdToResourceId = {}) {
    for (const menu of menus) {
        const resource = await Resource.create({
            id: uuidv4(),
            name: menu.title,
            path: menu.resource_path || menu.path,
            description: `Recurso criado automaticamente baseado no menu: ${menu.title}`,
            type: getResourceTypeFromPath(menu.path),
            icon: menu.icon,
            order: menu.order,
            is_active: menu.is_active,
            is_admin_only: menu.is_admin_only,
            parent_id: parentResourceId,
            metadata: {
                created_from_menu: true,
                original_menu_id: menu.id,
                original_menu_path: menu.path
            }
        });
        menuIdToResourceId[menu.id] = resource.id;

        // Atualizar menu com resource_id
        await Menu.update(
            { resource_id: resource.id },
            { where: { id: menu.id } }
        );

        // Se houver filhos, criar recursos recursivamente
        if (menu.children && Array.isArray(menu.children) && menu.children.length > 0) {
            await createResourcesFromMenus(menu.children, resource.id, menuIdToResourceId);
        }
    }
}

/**
 * Seeder para criar recursos baseados nos menus existentes
 * Este script analisa os menus existentes e cria recursos correspondentes
 */
async function seedResourcesFromMenus() {
    try {
        logger.info('Iniciando criação de recursos baseados nos menus...');
        const existingResources = await Resource.count();
        if (existingResources > 0) {
            logger.info(`Já existem ${existingResources} recursos no banco de dados.`);
            logger.info('Deseja continuar e criar recursos adicionais baseados nos menus? (y/N)');
            return;
        }

        // Buscar menus raiz e filhos
        const menus = await Menu.findAll({
            where: { parent_id: null },
            order: [['order', 'ASC'], ['title', 'ASC']],
            include: [{
                model: Menu,
                as: 'children',
                required: false,
                order: [['order', 'ASC'], ['title', 'ASC']],
                include: [{
                    model: Menu,
                    as: 'children',
                    required: false,
                    order: [['order', 'ASC'], ['title', 'ASC']]
                }]
            }]
        });

        if (menus.length === 0) {
            logger.info('Nenhum menu encontrado. Execute primeiro o seed de menus.');
            return;
        }

        logger.info(`Encontrados ${menus.length} menus raiz. Criando recursos correspondentes...`);

        // Criar recursos recursivamente
        await createResourcesFromMenus(menus);

        logger.info('Recursos criados com hierarquia baseada nos menus!');
        return true;
    } catch (error) {
        logger.error('Erro ao criar recursos baseados nos menus:', error);
        throw error;
    }
}

/**
 * Determina o tipo de recurso baseado no caminho do menu
 */
function getResourceTypeFromPath(path) {
    if (!path) return 'PAGE';
    
    const lowerPath = path.toLowerCase();
    
    // URLs externas são consideradas MENU
    if (lowerPath.startsWith('http')) {
        return 'MENU';
    }
    
    // Páginas HTML são PAGE
    if (lowerPath.includes('.html')) {
        return 'PAGE';
    }
    
    // APIs são API
    if (lowerPath.includes('/api/')) {
        return 'API';
    }
    
    // Menus administrativos são MENU
    if (lowerPath.includes('/admin/') || lowerPath.includes('/pages/admin/')) {
        return 'MENU';
    }
    
    // Configurações são MENU
    if (lowerPath.includes('settings') || lowerPath.includes('config')) {
        return 'MENU';
    }
    
    // Padrão é PAGE
    return 'PAGE';
}

// Executar o seeder se este arquivo for chamado diretamente
if (require.main === module) {
    (async () => {
        try {
            await seedResourcesFromMenus();
            process.exit(0);
        } catch (error) {
            console.error('Erro ao executar seeder:', error);
            process.exit(1);
        }
    })();
}

module.exports = seedResourcesFromMenus;