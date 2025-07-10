/**
 * Script para verificar a estrutura da tabela de menus no banco de dados
 */
const { sequelize } = require('../config/database');
const { Menu } = require('../models/postgresql/associations');
const logger = require('../utils/logger');

async function checkMenuTable() {
    try {
        console.log('Verificando conexão com o banco de dados...');
        await sequelize.authenticate();
        console.log('Conexão com o banco estabelecida com sucesso!');
        
        console.log('\nVerificando estrutura da tabela de menus:');
        
        // Obter informações da tabela
        const [tableInfo] = await sequelize.query(`
            SELECT table_name, column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'Menus'
            ORDER BY ordinal_position
        `);
        
        if (tableInfo.length === 0) {
            console.error('Tabela "Menus" não encontrada!');
            return;
        }
        
        console.log('\nEstrutura da tabela Menus:');
        console.log('=======================================');
        tableInfo.forEach(column => {
            console.log(`${column.column_name}: ${column.data_type} ${column.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${column.column_default ? `DEFAULT ${column.column_default}` : ''}`);
        });
        
        // Verificar se há constraints
        const [constraintInfo] = await sequelize.query(`
            SELECT 
                tc.constraint_name, 
                tc.constraint_type,
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM 
                information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                LEFT JOIN information_schema.constraint_column_usage ccu
                    ON tc.constraint_name = ccu.constraint_name
            WHERE 
                tc.table_name = 'Menus'
            ORDER BY 
                tc.constraint_type, tc.constraint_name;
        `);
        
        console.log('\nConstraints da tabela Menus:');
        console.log('=======================================');
        constraintInfo.forEach(constraint => {
            if (constraint.constraint_type === 'PRIMARY KEY') {
                console.log(`PRIMARY KEY on ${constraint.column_name}`);
            } else if (constraint.constraint_type === 'FOREIGN KEY') {
                console.log(`FOREIGN KEY ${constraint.column_name} REFERENCES ${constraint.foreign_table_name}(${constraint.foreign_column_name})`);
            } else {
                console.log(`${constraint.constraint_type} ${constraint.constraint_name} on ${constraint.column_name}`);
            }
        });
        
        // Contar registros na tabela
        const [countResult] = await sequelize.query('SELECT COUNT(*) FROM "Menus"');
        const count = parseInt(countResult[0].count);
        console.log(`\nTotal de registros na tabela: ${count}`);
        
        if (count > 0) {
            // Mostrar alguns registros de exemplo
            const [sampleRows] = await sequelize.query('SELECT * FROM "Menus" LIMIT 3');
            console.log('\nExemplos de registros:');
            console.log('=======================================');
            sampleRows.forEach(row => {
                console.log(JSON.stringify(row, null, 2));
            });
        }
        
        // Verificar se Menu.update está funcionando corretamente
        if (count > 0) {
            try {
                console.log('\nTestando atualização de menu...');
                // Pegar um menu existente
                const menu = await Menu.findOne();
                if (menu) {
                    const originalTitle = menu.title;
                    const testTitle = `${originalTitle} (teste ${Date.now()})`;
                    
                    console.log(`Atualizando menu ${menu.id} de "${originalTitle}" para "${testTitle}"`);
                    
                    // Tentar atualizar o menu
                    await menu.update({ title: testTitle });
                    console.log('Menu atualizado com sucesso!');
                    
                    // Restaurar título original
                    await menu.update({ title: originalTitle });
                    console.log('Título restaurado com sucesso!');
                }
            } catch (updateError) {
                console.error('Erro ao testar atualização:', updateError);
            }
        }
        
        console.log('\nVerificação concluída!');
    } catch (error) {
        console.error('Erro ao verificar tabela de menus:', error);
    } finally {
        process.exit(0);
    }
}

// Executar script se chamado diretamente
if (require.main === module) {
    checkMenuTable();
} 