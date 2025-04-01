/**
 * Script para corrigir problemas em módulos de aprendizado
 * 
 * Este script verifica todos os módulos de aprendizado e corrige problemas estruturais,
 * como módulos sem conteúdo ou seções, ou com estrutura incorreta.
 */

require('dotenv').config();
const { LearningModule } = require('../models/postgresql');
const { sequelize } = require('../config/database');
const { initDatabase } = require('../models/postgresql');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

async function fixModules() {
    try {
        // Inicializar banco de dados
        await initDatabase();
        
        logger.info('Iniciando correção de módulos de aprendizado...');
        
        // Buscar todos os módulos
        const modules = await LearningModule.findAll();
        logger.info(`Encontrados ${modules.length} módulos para verificar`);
        
        let fixedCount = 0;
        
        // Verificar e corrigir cada módulo
        for (const module of modules) {
            let needsUpdate = false;
            let updates = {};
            
            logger.info(`Verificando módulo: ${module.id} (${module.title})`);
            
            // Verificar conteúdo
            if (!module.content || typeof module.content !== 'object') {
                logger.warn(`- Módulo ${module.id} tem conteúdo inválido`);
                updates.content = {};
                needsUpdate = true;
            } else {
                // Verificar se cada página no conteúdo tem estrutura válida
                const fixedContent = { ...module.content };
                let contentFixed = false;
                
                for (const pageId in fixedContent) {
                    const page = fixedContent[pageId];
                    
                    // Verificar se a página é um objeto válido
                    if (!page || typeof page !== 'object') {
                        logger.warn(`- Página ${pageId} tem estrutura inválida, corrigindo`);
                        fixedContent[pageId] = {
                            title: 'Página sem título',
                            content: 'Conteúdo não disponível'
                        };
                        contentFixed = true;
                    } else {
                        // Garantir que a página tenha as propriedades necessárias
                        if (!page.title) {
                            logger.warn(`- Página ${pageId} não tem título, adicionando título padrão`);
                            page.title = 'Página sem título';
                            contentFixed = true;
                        }
                        
                        if (!page.content) {
                            logger.warn(`- Página ${pageId} não tem conteúdo, adicionando conteúdo padrão`);
                            page.content = 'Conteúdo não disponível';
                            contentFixed = true;
                        }
                    }
                }
                
                if (contentFixed) {
                    updates.content = fixedContent;
                    needsUpdate = true;
                }
            }
            
            // Verificar seções
            if (!module.sections || !Array.isArray(module.sections)) {
                logger.warn(`- Módulo ${module.id} tem seções inválidas`);
                updates.sections = [];
                needsUpdate = true;
            } else if (module.sections.length > 0) {
                // Verificar estrutura das seções
                const fixedSections = module.sections.map(section => {
                    // Verificar se a seção tem o formato esperado
                    if (!section || typeof section !== 'object') {
                        logger.warn(`- Seção inválida encontrada, criando nova seção`);
                        return {
                            id: uuidv4(),
                            title: 'Seção corrigida',
                            pages: []
                        };
                    }
                    
                    // Garantir que a seção tenha um ID
                    if (!section.id) {
                        section.id = uuidv4();
                        logger.warn(`- Adicionado ID para seção: ${section.title || 'Sem título'}`);
                    }
                    
                    // Garantir que a seção tenha um título
                    if (!section.title) {
                        section.title = 'Seção sem título';
                        logger.warn(`- Adicionado título para seção: ${section.id}`);
                    }
                    
                    // Verificar páginas da seção
                    if (!section.pages || !Array.isArray(section.pages)) {
                        section.pages = [];
                        logger.warn(`- Corrigido array de páginas para seção: ${section.title}`);
                    } else {
                        // Filtrar apenas páginas válidas
                        const validPages = section.pages.filter(pageId => {
                            // Verificar se o pageId é uma string ou número (não objeto)
                            if (typeof pageId === 'object') {
                                logger.warn(`- Removida referência a página inválida (objeto) na seção: ${section.title}`);
                                return false;
                            }
                            
                            // Verificar se a página existe no conteúdo
                            const pageIdStr = String(pageId);
                            if (module.content && module.content[pageIdStr]) {
                                return true;
                            } else {
                                logger.warn(`- Removida referência a página inexistente: ${pageIdStr} na seção: ${section.title}`);
                                return false;
                            }
                        });
                        
                        if (validPages.length !== section.pages.length) {
                            logger.warn(`- Removidas ${section.pages.length - validPages.length} páginas inválidas da seção: ${section.title}`);
                            section.pages = validPages;
                        }
                    }
                    
                    return section;
                });
                
                // Verificar se alguma seção foi corrigida
                if (JSON.stringify(fixedSections) !== JSON.stringify(module.sections)) {
                    logger.warn(`- Módulo ${module.id} teve seções corrigidas`);
                    updates.sections = fixedSections;
                    needsUpdate = true;
                }
            }
            
            // Verificar outras propriedades obrigatórias
            if (!module.title) {
                updates.title = 'Módulo sem título';
                needsUpdate = true;
            }
            
            if (!module.route) {
                updates.route = `/learn/${module.id}`;
                needsUpdate = true;
            }
            
            // Atualizar módulo se necessário
            if (needsUpdate) {
                logger.info(`Atualizando módulo ${module.id}`);
                await module.update(updates);
                fixedCount++;
            }
        }
        
        logger.info(`Correção concluída. ${fixedCount} módulos foram corrigidos.`);
        
    } catch (error) {
        logger.error('Erro ao corrigir módulos:', error);
    } finally {
        // Fechar conexão com o banco de dados
        await sequelize.close();
    }
}

// Executar o script
fixModules().catch(error => {
    logger.error('Erro fatal:', error);
    process.exit(1);
}); 