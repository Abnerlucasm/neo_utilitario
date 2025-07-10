/**
 * Script para verificar e reparar a tabela de menus
 */
const { sequelize, Menu } = require('../models/postgresql/associations');
const logger = require('../utils/logger');

async function checkMenusTable() {
    try {
        logger.info('Iniciando verificação da tabela de menus...');
        
        // Verificar se a tabela existe
        const [results] = await sequelize.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND table_name = 'Menus'
            );
        `);
        
        const tableExists = results[0].exists;
        
        if (!tableExists) {
            logger.error('Tabela Menus não existe! Executando script de criação...');
            // Executar script de criação da tabela
            const createMenuTable = require('./create-menu-table');
            await createMenuTable();
            return true;
        }
        
        // Verificar integridade da tabela
        logger.info('Verificando integridade da tabela Menus...');
        
        // Contar menus
        const menuCount = await Menu.count();
        logger.info(`Contagem de menus: ${menuCount}`);
        
        // Verificar menus de nível superior
        const rootMenus = await Menu.findAll({ where: { parentId: null } });
        logger.info(`Menus de nível superior: ${rootMenus.length}`);
        
        // Verificar colunas importantes
        const missingColumns = [];
        try {
            const [columns] = await sequelize.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'Menus' AND table_schema = 'public';
            `);
            
            const columnNames = columns.map(c => c.column_name);
            logger.info(`Colunas da tabela: ${columnNames.join(', ')}`);
            
            const requiredColumns = ['id', 'title', 'path', 'icon', 'order', 'parentid', 'isadminonly', 'isactive', 'resourcepath'];
            requiredColumns.forEach(col => {
                if (!columnNames.includes(col)) {
                    missingColumns.push(col);
                }
            });
            
            if (missingColumns.length > 0) {
                logger.error(`Colunas ausentes: ${missingColumns.join(', ')}`);
            }
        } catch (error) {
            logger.error('Erro ao verificar colunas:', error);
        }
        
        // Executar seed se não houver menus
        if (menuCount === 0) {
            logger.warn('Nenhum menu encontrado. Executando seed...');
            const seedMenus = require('./seed-menus');
            await seedMenus();
            return true;
        }
        
        // Reparar menus órfãos (parentId aponta para menu inexistente)
        try {
            const [orphanMenus] = await sequelize.query(`
                SELECT id, title FROM "Menus" m 
                WHERE "parentId" IS NOT NULL 
                AND NOT EXISTS (SELECT 1 FROM "Menus" p WHERE p.id = m."parentId");
            `);
            
            if (orphanMenus.length > 0) {
                logger.warn(`Encontrados ${orphanMenus.length} menus órfãos. Corrigindo...`);
                
                for (const menu of orphanMenus) {
                    logger.info(`Corrigindo menu órfão: ${menu.title} (${menu.id})`);
                    await Menu.update({ parentId: null }, { where: { id: menu.id } });
                }
                
                logger.info('Menus órfãos corrigidos');
            }
        } catch (error) {
            logger.error('Erro ao verificar menus órfãos:', error);
        }
        
        logger.info('Verificação da tabela de menus concluída com sucesso!');
        return true;
    } catch (error) {
        logger.error('Erro ao verificar tabela de menus:', error);
        throw error;
    }
}

// Executar o script se for chamado diretamente
if (require.main === module) {
    (async () => {
        try {
            await checkMenusTable();
            process.exit(0);
        } catch (error) {
            console.error('Erro ao executar script:', error);
            process.exit(1);
        }
    })();
}

module.exports = checkMenusTable; 