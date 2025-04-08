/**
 * Script para verificar e corrigir a estrutura da tabela de menus
 */
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

async function fixMenuTable() {
    try {
        console.log('Verificando conexão com o banco de dados...');
        await sequelize.authenticate();
        console.log('Conexão com o banco estabelecida com sucesso!\n');
        
        console.log('Verificando estrutura da tabela de menus...');
        
        // Verificar se a tabela existe
        const tableExists = await sequelize.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'Menus'
            );
        `, { plain: true });
        
        if (!tableExists.exists) {
            console.error('Tabela "Menus" não existe!');
            return;
        }
        
        console.log('Tabela "Menus" encontrada!');
        
        // Verificar se todas as colunas necessárias existem
        const columns = await sequelize.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'Menus'
            ORDER BY ordinal_position;
        `, { type: sequelize.QueryTypes.SELECT });
        
        console.log('Colunas encontradas:');
        columns.forEach(col => {
            console.log(`- ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
        });
        
        // Verificar coluna resourcePath
        const resourcePathColumn = columns.find(col => col.column_name === 'resourcePath');
        
        if (!resourcePathColumn) {
            console.log('\nColuna "resourcePath" não encontrada. Criando...');
            
            await sequelize.query(`
                ALTER TABLE "Menus"
                ADD COLUMN "resourcePath" VARCHAR(255) NULL
            `);
            
            console.log('Coluna "resourcePath" criada com sucesso!');
            
            // Atualizar resourcePath com valores de path
            console.log('Populando "resourcePath" com valores de "path"...');
            
            await sequelize.query(`
                UPDATE "Menus"
                SET "resourcePath" = "path"
                WHERE "resourcePath" IS NULL
            `);
            
            console.log('Coluna "resourcePath" populada!');
        } else if (resourcePathColumn.is_nullable === 'NO') {
            console.log('\nColuna "resourcePath" está definida como NOT NULL. Corrigindo...');
            
            // Primeiro, garantir que todos os registros tenham um valor
            await sequelize.query(`
                UPDATE "Menus"
                SET "resourcePath" = "path"
                WHERE "resourcePath" IS NULL
            `);
            
            // Depois, alterar a coluna para permitir NULL
            await sequelize.query(`
                ALTER TABLE "Menus"
                ALTER COLUMN "resourcePath" DROP NOT NULL
            `);
            
            console.log('Coluna "resourcePath" corrigida para permitir NULL!');
        }
        
        // Verificar índices
        console.log('\nVerificando índices...');
        
        const indices = await sequelize.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'Menus';
        `, { type: sequelize.QueryTypes.SELECT });
        
        console.log('Índices encontrados:');
        indices.forEach(idx => {
            console.log(`- ${idx.indexname}: ${idx.indexdef}`);
        });
        
        // Verificar restrições
        console.log('\nVerificando restrições...');
        
        const constraints = await sequelize.query(`
            SELECT conname, contype, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'Menus';
        `, { type: sequelize.QueryTypes.SELECT });
        
        console.log('Restrições encontradas:');
        constraints.forEach(con => {
            console.log(`- ${con.conname} (${con.contype}): ${con.pg_get_constraintdef}`);
        });
        
        console.log('\n✅ Verificação e correção da estrutura da tabela concluídas!');
    } catch (error) {
        console.error('Erro ao verificar/corrigir tabela de menus:', error);
    } finally {
        process.exit(0);
    }
}

// Executar script se chamado diretamente
if (require.main === module) {
    fixMenuTable();
} 