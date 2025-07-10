const { sequelize, Menu, Resource } = require('../models/postgresql/associations');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Seeder para criar recursos baseados nos menus existentes
 * Este script analisa os menus existentes e cria recursos correspondentes
 */
async function seedResourcesFromMenus() {
    try {
        logger.info('Iniciando criação de recursos baseados nos menus...');
        
        // Verificar se já existem recursos
        const existingResources = await Resource.count();
        
        if (existingResources > 0) {
            logger.info(`Já existem ${existingResources} recursos no banco de dados.`);
            logger.info('Deseja continuar e criar recursos adicionais baseados nos menus? (y/N)');
            return;
        }
        
        // Buscar todos os menus
        const menus = await Menu.findAll({
            order: [['order', 'ASC'], ['title', 'ASC']]
        });
        
        if (menus.length === 0) {
            logger.info('Nenhum menu encontrado. Execute primeiro o seed de menus.');
            return;
        }
        
        logger.info(`Encontrados ${menus.length} menus. Criando recursos correspondentes...`);
        
        const resources = [];
        const resourceMap = new Map(); // Para mapear menu.id -> resource.id
        
        // Criar recursos baseados nos menus
        for (const menu of menus) {
            const resource = {
                id: uuidv4(),
                name: menu.title,
                path: menu.resource_path || menu.path,
                description: `Recurso criado automaticamente baseado no menu: ${menu.title}`,
                type: getResourceTypeFromPath(menu.path),
                icon: menu.icon,
                order: menu.order,
                is_active: menu.is_active,
                is_admin_only: menu.is_admin_only,
                parent_id: null, // Será atualizado depois
                metadata: {
                    created_from_menu: true,
                    original_menu_id: menu.id,
                    original_menu_path: menu.path
                }
            };
            
            resources.push(resource);
            resourceMap.set(menu.id, resource.id);
        }
        
        // Inserir recursos
        await Resource.bulkCreate(resources);
        logger.info(`${resources.length} recursos criados com sucesso!`);
        
        // Atualizar parent_id dos recursos baseado na hierarquia dos menus
        await updateResourceHierarchy(menus, resourceMap);
        
        // Atualizar menus com os resource_id correspondentes
        await updateMenusWithResourceIds(menus, resourceMap);
        
        logger.info('Processo concluído com sucesso!');
        
        // Mostrar estatísticas
        const totalResources = await Resource.count();
        const activeResources = await Resource.count({ where: { is_active: true } });
        const menuResources = await Resource.count({ where: { type: 'MENU' } });
        const pageResources = await Resource.count({ where: { type: 'PAGE' } });
        
        logger.info('Estatísticas finais:');
        logger.info(`- Total de recursos: ${totalResources}`);
        logger.info(`- Recursos ativos: ${activeResources}`);
        logger.info(`- Recursos do tipo MENU: ${menuResources}`);
        logger.info(`- Recursos do tipo PAGE: ${pageResources}`);
        
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

/**
 * Atualiza a hierarquia dos recursos baseada na hierarquia dos menus
 */
async function updateResourceHierarchy(menus, resourceMap) {
    logger.info('Atualizando hierarquia dos recursos...');
    
    for (const menu of menus) {
        if (menu.parent_id && resourceMap.has(menu.parent_id)) {
            const resourceId = resourceMap.get(menu.id);
            const parentResourceId = resourceMap.get(menu.parent_id);
            
            await Resource.update(
                { parent_id: parentResourceId },
                { where: { id: resourceId } }
            );
        }
    }
    
    logger.info('Hierarquia dos recursos atualizada!');
}

/**
 * Atualiza os menus com os resource_id correspondentes
 */
async function updateMenusWithResourceIds(menus, resourceMap) {
    logger.info('Atualizando menus com resource_id...');
    
    for (const menu of menus) {
        if (resourceMap.has(menu.id)) {
            const resourceId = resourceMap.get(menu.id);
            
            await Menu.update(
                { resource_id: resourceId },
                { where: { id: menu.id } }
            );
        }
    }
    
    logger.info('Menus atualizados com resource_id!');
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