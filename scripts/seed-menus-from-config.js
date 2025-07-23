const { Menu } = require('../models/postgresql/associations');
const menuStructure = require('../config/menu-structure.json');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Cria ou atualiza menus e submenus recursivamente, mantendo parent_id
 */
async function upsertMenusWithHierarchy(menus, parentId = null) {
    for (const menu of menus) {
        // Tenta encontrar menu existente pelo path (ou title)
        let existingMenu = await Menu.findOne({ where: { path: menu.path } });
        let menuData = {
            title: menu.title,
            path: menu.path,
            icon: menu.icon || 'fas fa-link',
            order: menu.order || 0,
            parent_id: parentId,
            is_admin_only: menu.is_admin_only || false,
            is_active: menu.is_active !== false,
            resource_path: menu.resource_path || menu.path
        };

        let createdMenu;
        if (existingMenu) {
            await existingMenu.update(menuData);
            createdMenu = existingMenu;
            logger.info(`Menu atualizado: ${menu.title}`);
        } else {
            menuData.id = uuidv4();
            createdMenu = await Menu.create(menuData);
            logger.info(`Menu criado: ${menu.title}`);
        }

        // Se houver filhos, criar/atualizar recursivamente
        if (menu.children && Array.isArray(menu.children)) {
            await upsertMenusWithHierarchy(menu.children, createdMenu.id);
        }
    }
}

async function seedMenusFromConfig() {
    try {
        logger.info('Iniciando seed automático de menus...');
        await upsertMenusWithHierarchy(menuStructure);
        logger.info('Menus criados/atualizados automaticamente com sucesso!');
    } catch (error) {
        logger.error('Erro ao criar menus automáticos:', error);
        throw error;
    }
}

if (require.main === module) {
    (async () => {
        await seedMenusFromConfig();
        process.exit(0);
    })();
}

module.exports = seedMenusFromConfig;
