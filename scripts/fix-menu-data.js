/**
 * Script para verificar e corrigir problemas nos dados de menus
 */
const { sequelize } = require('../config/database');
const { Menu } = require('../models/postgresql/associations');
const logger = require('../utils/logger');

async function fixMenuData() {
    try {
        console.log('Verificando conexão com o banco de dados...');
        await sequelize.authenticate();
        console.log('Conexão com o banco estabelecida com sucesso!\n');
        
        // Verificar menus com dados potencialmente problemáticos
        console.log('Verificando menus com dados potencialmente problemáticos...');
        
        // 1. Menus com parentId inválido
        console.log('\nVerificando menus com parentId inválido...');
        const menusWithParentId = await Menu.findAll({
            where: {
                parentId: {
                    [sequelize.Sequelize.Op.not]: null
                }
            }
        });
        
        const invalidParentIds = [];
        for (const menu of menusWithParentId) {
            const parentExists = await Menu.findByPk(menu.parentId);
            if (!parentExists) {
                invalidParentIds.push(menu.id);
                console.log(`Menu "${menu.title}" (${menu.id}) tem parentId inválido: ${menu.parentId}`);
            }
        }
        
        if (invalidParentIds.length > 0) {
            console.log(`\nEncontrados ${invalidParentIds.length} menus com parentId inválido.`);
            const fix = process.argv.includes('--fix');
            
            if (fix) {
                console.log('Corrigindo menus com parentId inválido...');
                for (const menuId of invalidParentIds) {
                    const menu = await Menu.findByPk(menuId);
                    await menu.update({ parentId: null });
                    console.log(`Menu "${menu.title}" (${menu.id}) corrigido: parentId definido como null`);
                }
            } else {
                console.log('Para corrigir, execute: node scripts/fix-menu-data.js --fix');
            }
        } else {
            console.log('Nenhum menu com parentId inválido encontrado.');
        }
        
        // 2. Verificar menus com resourcePath null mas path não null
        console.log('\nVerificando menus com resourcePath null mas path não null...');
        const menusWithoutResourcePath = await Menu.findAll({
            where: {
                resourcePath: null
            }
        });
        
        if (menusWithoutResourcePath.length > 0) {
            console.log(`Encontrados ${menusWithoutResourcePath.length} menus sem resourcePath:`);
            
            const fix = process.argv.includes('--fix');
            if (fix) {
                console.log('Corrigindo menus sem resourcePath...');
                for (const menu of menusWithoutResourcePath) {
                    await menu.update({ resourcePath: menu.path });
                    console.log(`Menu "${menu.title}" (${menu.id}) corrigido: resourcePath = "${menu.path}"`);
                }
            } else {
                menusWithoutResourcePath.forEach(menu => {
                    console.log(`- Menu "${menu.title}" (${menu.id}), path: "${menu.path}", resourcePath: null`);
                });
                console.log('Para corrigir, execute: node scripts/fix-menu-data.js --fix');
            }
        } else {
            console.log('Nenhum menu sem resourcePath encontrado.');
        }
        
        // 3. Verificar menus auto-referenciados (parentId igual ao próprio id)
        console.log('\nVerificando menus auto-referenciados...');
        const selfReferencingMenus = await sequelize.query(
            `SELECT * FROM "Menus" WHERE "id" = "parentId"`,
            { type: sequelize.QueryTypes.SELECT }
        );
        
        if (selfReferencingMenus.length > 0) {
            console.log(`Encontrados ${selfReferencingMenus.length} menus auto-referenciados:`);
            
            const fix = process.argv.includes('--fix');
            if (fix) {
                console.log('Corrigindo menus auto-referenciados...');
                for (const menuData of selfReferencingMenus) {
                    const menu = await Menu.findByPk(menuData.id);
                    await menu.update({ parentId: null });
                    console.log(`Menu "${menu.title}" (${menu.id}) corrigido: parentId definido como null`);
                }
            } else {
                selfReferencingMenus.forEach(menu => {
                    console.log(`- Menu "${menu.title}" (${menu.id}) tem parentId igual ao próprio ID`);
                });
                console.log('Para corrigir, execute: node scripts/fix-menu-data.js --fix');
            }
        } else {
            console.log('Nenhum menu auto-referenciado encontrado.');
        }
        
        // 4. Verificar valores NULL em campos que deveriam ser NOT NULL
        console.log('\nVerificando campos NULL em colunas NOT NULL...');
        
        const notNullFields = ['title', 'path', 'icon', 'order', 'isAdminOnly', 'isActive'];
        
        for (const field of notNullFields) {
            const query = `SELECT COUNT(*) as count FROM "Menus" WHERE "${field}" IS NULL`;
            const [result] = await sequelize.query(query, { 
                type: sequelize.QueryTypes.SELECT 
            });
            
            if (result.count > 0) {
                console.log(`ALERTA: Encontrados ${result.count} menus com ${field} NULL`);
                
                const menusWithNull = await sequelize.query(
                    `SELECT * FROM "Menus" WHERE "${field}" IS NULL`,
                    { type: sequelize.QueryTypes.SELECT }
                );
                
                const fix = process.argv.includes('--fix');
                if (fix) {
                    console.log(`Corrigindo menus com ${field} NULL...`);
                    
                    // Definir valores padrão adequados para cada campo
                    const defaultValues = {
                        title: 'Menu sem título',
                        path: '/sem-caminho',
                        icon: 'fas fa-link',
                        order: 0,
                        isAdminOnly: false,
                        isActive: true
                    };
                    
                    for (const menuData of menusWithNull) {
                        const menu = await Menu.findByPk(menuData.id);
                        const updateData = { [field]: defaultValues[field] };
                        await menu.update(updateData);
                        console.log(`Menu ID ${menu.id} corrigido: ${field} = "${defaultValues[field]}"`);
                    }
                } else {
                    menusWithNull.forEach(menu => {
                        console.log(`- Menu ID ${menu.id}, título: "${menu.title}" tem ${field} NULL`);
                    });
                    console.log('Para corrigir, execute: node scripts/fix-menu-data.js --fix');
                }
            } else {
                console.log(`Todos os menus têm valores válidos para o campo "${field}".`);
            }
        }
        
        // 5. Verificar consistência de tipos de dados
        console.log('\nVerificando consistência de tipos de dados...');
        
        // Verificar se order é numérico
        const [ordersResult] = await sequelize.query(
            `SELECT id, title, "order" FROM "Menus" WHERE "order" IS NOT NULL AND "order"::text ~ '[^0-9]'`,
            { type: sequelize.QueryTypes.SELECT }
        );
        
        if (ordersResult && Object.keys(ordersResult).length > 0) {
            console.log('Encontrados menus com valor de "order" não numérico:');
            console.log(ordersResult);
            
            const fix = process.argv.includes('--fix');
            if (fix) {
                console.log('Corrigindo valores de "order" não numéricos...');
                for (const menuId of Object.keys(ordersResult)) {
                    const menu = await Menu.findByPk(menuId);
                    if (menu) {
                        await menu.update({ order: 0 });
                        console.log(`Menu "${menu.title}" (${menu.id}) corrigido: order = 0`);
                    }
                }
            }
        } else {
            console.log('Todos os valores de "order" são numéricos.');
        }
        
        // 6. Verificar valores booleanos
        const booleanFields = ['isAdminOnly', 'isActive'];
        for (const field of booleanFields) {
            const [boolResult] = await sequelize.query(
                `SELECT COUNT(*) as count FROM "Menus" WHERE "${field}" IS NOT NULL AND "${field}" != true AND "${field}" != false`,
                { type: sequelize.QueryTypes.SELECT }
            );
            
            if (boolResult.count > 0) {
                console.log(`ALERTA: Encontrados ${boolResult.count} menus com ${field} não booleano`);
                
                const fix = process.argv.includes('--fix');
                if (fix) {
                    console.log(`Corrigindo valores não booleanos de ${field}...`);
                    await sequelize.query(
                        `UPDATE "Menus" SET "${field}" = true WHERE "${field}" IS NOT NULL AND "${field}" != true AND "${field}" != false`,
                        { type: sequelize.QueryTypes.UPDATE }
                    );
                    console.log(`${boolResult.count} registros corrigidos.`);
                }
            } else {
                console.log(`Todos os valores de "${field}" são booleanos.`);
            }
        }
        
        console.log('\n✅ Verificação e correção concluídas!');
    } catch (error) {
        console.error('Erro ao verificar/corrigir dados de menus:', error);
    } finally {
        process.exit(0);
    }
}

// Executar script se chamado diretamente
if (require.main === module) {
    fixMenuData();
} 