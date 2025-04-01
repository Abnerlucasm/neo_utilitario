/**
 * Script para criar a tabela de menus manualmente
 */
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

async function createMenuTable() {
    try {
        logger.info('Iniciando criação da tabela de menus...');
        
        // Verificar se a tabela já existe
        const [results] = await sequelize.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND table_name = 'Menus'
            );
        `);
        
        const tableExists = results[0].exists;
        
        if (tableExists) {
            logger.info('Tabela de menus já existe. Pulando criação.');
            return;
        }
        
        logger.info('Criando tabela de menus...');
        
        // Criar tabela
        await sequelize.query(`
            CREATE TABLE "Menus" (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(255) NOT NULL,
                path VARCHAR(255) NOT NULL,
                icon VARCHAR(255) NOT NULL DEFAULT 'fas fa-link',
                "order" INTEGER NOT NULL DEFAULT 0,
                "parentId" UUID REFERENCES "Menus" (id),
                "isAdminOnly" BOOLEAN NOT NULL DEFAULT false,
                "isActive" BOOLEAN NOT NULL DEFAULT true,
                "resourcePath" VARCHAR(255),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            
            COMMENT ON COLUMN "Menus"."resourcePath" IS 'Caminho do recurso para verificação de permissão';
        `);
        
        logger.info('Tabela de menus criada com sucesso!');
        
        // Executar seed de menus
        const seedMenus = require('./seed-menus');
        await seedMenus();
        
        return true;
    } catch (error) {
        logger.error('Erro ao criar tabela de menus:', error);
        throw error;
    }
}

// Executar o script se for chamado diretamente
if (require.main === module) {
    (async () => {
        try {
            await createMenuTable();
            process.exit(0);
        } catch (error) {
            console.error('Erro ao executar script:', error);
            process.exit(1);
        }
    })();
}

module.exports = createMenuTable; 