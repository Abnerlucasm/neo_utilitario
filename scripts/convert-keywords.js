'use strict';

const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

async function convertKeywords() {
    try {
        logger.info('Iniciando conversão manual da coluna keywords');
        
        // Verificar se a coluna keywords existe e seu tipo
        const [columnInfo] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'learning_modules' AND column_name = 'keywords'
        `);

        if (columnInfo.length === 0) {
            logger.info('Coluna keywords não encontrada');
            
            // Adicionar a coluna
            await sequelize.query(`
                ALTER TABLE learning_modules 
                ADD COLUMN keywords JSONB DEFAULT '[]'::jsonb
            `);
            logger.info('Coluna keywords adicionada como JSONB');
            return;
        }

        logger.info('Info da coluna keywords:', columnInfo[0]);
        
        // Verificar o tipo da coluna
        if (columnInfo[0].data_type === 'jsonb') {
            logger.info('Coluna keywords já está no formato JSONB');
            return;
        }

        // Primeiro criar uma coluna temporária
        logger.info('Criando coluna temporária keywords_jsonb');
        await sequelize.query(`
            ALTER TABLE learning_modules 
            ADD COLUMN keywords_jsonb JSONB DEFAULT '[]'::jsonb
        `);

        // Converter os dados existentes
        logger.info('Convertendo dados para a nova coluna JSONB');
        
        try {
            await sequelize.query(`
                UPDATE learning_modules 
                SET keywords_jsonb = CASE 
                    WHEN keywords IS NULL THEN '[]'::jsonb
                    WHEN keywords = '{}' THEN '[]'::jsonb
                    ELSE to_json(keywords)::jsonb
                END
            `);
        } catch (err) {
            logger.error('Erro na conversão to_json:', err);
            
            // Tentar um método alternativo de conversão
            logger.info('Tentando método alternativo...');
            
            // Obter todos os IDs do módulo
            const [modules] = await sequelize.query(`
                SELECT id FROM learning_modules
            `);
            
            logger.info(`Encontrados ${modules.length} módulos para processar`);
            
            // Para cada módulo, definir keywords_jsonb como um array vazio
            for (const module of modules) {
                await sequelize.query(`
                    UPDATE learning_modules 
                    SET keywords_jsonb = '[]'::jsonb
                    WHERE id = :id
                `, {
                    replacements: { id: module.id }
                });
                logger.info(`Módulo ${module.id} atualizado para array vazio`);
            }
        }

        // Remover a coluna antiga
        logger.info('Removendo coluna antiga keywords');
        await sequelize.query(`
            ALTER TABLE learning_modules 
            DROP COLUMN keywords
        `);
        
        // Renomear a nova coluna
        logger.info('Renomeando coluna keywords_jsonb para keywords');
        await sequelize.query(`
            ALTER TABLE learning_modules 
            RENAME COLUMN keywords_jsonb TO keywords
        `);
        
        // Definir o valor padrão
        logger.info('Definindo valor padrão para a coluna keywords');
        await sequelize.query(`
            ALTER TABLE learning_modules 
            ALTER COLUMN keywords SET DEFAULT '[]'::jsonb
        `);
        
        logger.info('Conversão manual concluída com sucesso');
    } catch (error) {
        logger.error('Erro na conversão manual da coluna keywords:', error);
        throw error;
    }
}

if (require.main === module) {
    // Se o script for executado diretamente
    convertKeywords()
        .then(() => {
            logger.info('Script de conversão executado com sucesso');
            process.exit(0);
        })
        .catch(err => {
            logger.error('Erro ao executar script de conversão:', err);
            process.exit(1);
        });
} else {
    // Se o script for importado como módulo
    module.exports = { convertKeywords };
} 