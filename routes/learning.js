const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { LearningModule } = require('../models/postgresql');
const { Op } = require('sequelize');
const { requireAdmin } = require('../middlewares/ensure-admin');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/modules');
        // Criar diretório se não existir
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Usar UUID para nome de arquivo único e preservar a extensão original
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});

// Filtro para permitir apenas imagens
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Apenas imagens são permitidas!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

// Listar módulos
router.get('/modules', async (req, res) => {
    try {
        logger.info('Buscando todos os módulos de aprendizado');
        const modules = await LearningModule.findAll();
        
        // Garantir que todos os módulos possuam dados válidos
        const validatedModules = modules.map(module => {
            // Garantir que sections é um array
            if (!Array.isArray(module.sections)) {
                module.sections = [];
            }
            
            // Garantir que content é um objeto
            if (typeof module.content !== 'object' || module.content === null) {
                module.content = {};
            }
            
            // Garantir que keywords é um array
            if (!Array.isArray(module.keywords)) {
                module.keywords = [];
            }
            
            // Garantir que imageUrl tem um valor padrão se for null
            if (!module.imageUrl) {
                module.imageUrl = '/assets/default-module.jpg';
            }
            
            // Garantir que route tem um valor
            if (!module.route) {
                module.route = `/learn/${module.id}`;
            }
            
            return module;
        });
        
        logger.info(`${validatedModules.length} módulos encontrados e validados`);
        res.json(validatedModules || []);
    } catch (error) {
        logger.error('Erro ao listar módulos:', error);
        res.status(500).json({ 
            error: 'Erro ao listar módulos',
            details: error.message 
        });
    }
});

// Obter módulo específico
router.get('/modules/:id', async (req, res) => {
    try {
        const moduleId = req.params.id;
        logger.info(`Buscando módulo com ID: ${moduleId}`);
        
        const module = await LearningModule.findByPk(moduleId);
        if (!module) {
            logger.warn(`Módulo não encontrado: ${moduleId}`);
            return res.status(404).json({ 
                error: 'Módulo não encontrado',
                details: `Módulo com ID '${moduleId}' não existe`
            });
        }

        // Garantir que as seções e conteúdo estejam em formato válido
        try {
            // Garantir que sections é um array
            if (!Array.isArray(module.sections)) {
                module.sections = [];
                await module.save();
            }
            
            // Garantir que content é um objeto
            if (typeof module.content !== 'object' || module.content === null) {
                module.content = {};
                await module.save();
            }
            
            logger.info(`Módulo encontrado: ${module.title}, ID: ${module.id}`);
            res.json(module);
        } catch (parseError) {
            logger.error(`Erro ao processar dados do módulo ${moduleId}:`, parseError);
            res.status(500).json({
                error: 'Erro ao processar dados do módulo',
                details: parseError.message
            });
        }
    } catch (error) {
        logger.error(`Erro ao buscar módulo ${req.params.id}:`, error);
        res.status(500).json({ 
            error: 'Erro ao buscar módulo',
            details: error.message 
        });
    }
});

// Obter conteúdo completo de um módulo
router.get('/modules/:id/content', async (req, res) => {
    try {
        const moduleId = req.params.id;
        logger.info(`Buscando conteúdo do módulo com ID: ${moduleId}`);
        
        const module = await LearningModule.findByPk(moduleId);
        if (!module) {
            logger.warn(`Módulo não encontrado: ${moduleId}`);
            return res.status(404).json({ 
                error: 'Módulo não encontrado',
                details: `Módulo com ID '${moduleId}' não existe`
            });
        }

        // Preparar objeto de resposta com dados do módulo e seu conteúdo
        const moduleContent = {
            id: module.id,
            title: module.title,
            description: module.description,
            sections: Array.isArray(module.sections) ? module.sections : [],
            status: module.status,
            imageUrl: module.imageUrl,
            keywords: Array.isArray(module.keywords) ? module.keywords : []
        };
        
        logger.info(`Conteúdo do módulo ${moduleId} recuperado com sucesso`);
        res.json(moduleContent);
    } catch (error) {
        logger.error(`Erro ao buscar conteúdo do módulo ${req.params.id}:`, error);
        res.status(500).json({ 
            error: 'Erro ao buscar conteúdo do módulo',
            details: error.message 
        });
    }
});

// Criar módulo (apenas admin)
router.post('/modules', requireAdmin, upload.single('image'), async (req, res) => {
    try {
        logger.debug('Criando módulo:', { body: req.body, file: req.file });
        
        // Gerar um ID do módulo usando UUID
        let moduleId;
        
        // Regex para validar UUID v4
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        
        if (req.body.id && req.body.id.trim() !== '') {
            // Se o ID foi fornecido pelo usuário, validar se é um UUID válido
            if (uuidRegex.test(req.body.id.trim())) {
                moduleId = req.body.id.trim();
            } else {
                // Se não for um UUID válido, gerar um novo
                moduleId = uuidv4();
            }
        } else {
            // Se não foi fornecido ID, gerar um novo UUID
            moduleId = uuidv4();
        }
        
        // Verificar se já existe um módulo com este ID
        const existingModule = await LearningModule.findByPk(moduleId);
        if (existingModule) {
            // Se já existir, gerar um novo UUID
            moduleId = uuidv4();
        }
        
        // Preparar dados do módulo
        const moduleData = {
            id: moduleId,
            title: req.body.title,
            description: req.body.description,
            status: req.body.status || 'draft',
            route: `/learn/${moduleId}`,
            apiEndpoint: `/api/learning/${moduleId}/content`
        };
        
        // Se tiver upload de imagem, salvar o caminho
        if (req.file) {
            moduleData.imageUrl = `/uploads/modules/${req.file.filename}`;
        }
        
        // Criar o módulo no banco de dados
        const module = await LearningModule.create(moduleData);
        
        res.status(201).json(module);
    } catch (error) {
        logger.error('Erro ao criar módulo:', error);
        res.status(500).json({ 
            error: 'Erro ao criar módulo',
            details: error.message 
        });
    }
});

// Atualizar módulo (apenas admin)
router.put('/modules/:id', requireAdmin, upload.single('image'), async (req, res) => {
    try {
        logger.info(`Atualizando módulo com ID: ${req.params.id}`);
        logger.debug(`Dados recebidos: ${JSON.stringify(req.body, null, 2)}`);
        
        const module = await LearningModule.findByPk(req.params.id);
        if (!module) {
            logger.warn(`Módulo não encontrado: ${req.params.id}`);
            return res.status(404).json({ 
                error: 'Módulo não encontrado',
                details: `Módulo com ID '${req.params.id}' não existe`
            });
        }

        // Preparar dados para atualização
        const updateData = {};
        
        // Atualizar campos básicos apenas se fornecidos
        if (req.body.title) updateData.title = req.body.title;
        if (req.body.description) updateData.description = req.body.description;
        if (req.body.status) updateData.status = req.body.status;
        
        // Processar seções se fornecidas
        if (req.body.sections) {
            try {
                // Se enviado como string JSON, converter para objeto
                updateData.sections = typeof req.body.sections === 'string' 
                    ? JSON.parse(req.body.sections) 
                    : req.body.sections;
                
                logger.info(`Atualizando ${updateData.sections.length} seções para o módulo ${req.params.id}`);
                
                // Garantir que as seções estejam em formato de array
                if (!Array.isArray(updateData.sections)) {
                    updateData.sections = [];
                    logger.warn('Seções convertidas para array vazio pois não estavam no formato correto');
                }
            } catch (e) {
                logger.warn('Erro ao processar seções:', e);
                return res.status(400).json({
                    error: 'Erro ao processar dados',
                    details: 'Formato inválido para as seções'
                });
            }
        }
        
        // Processar conteúdo se fornecido
        if (req.body.content) {
            try {
                // Se enviado como string JSON, converter para objeto
                updateData.content = typeof req.body.content === 'string' 
                    ? JSON.parse(req.body.content) 
                    : req.body.content;
                
                logger.info(`Atualizando conteúdo para o módulo ${req.params.id}`);
                
                // Garantir que o conteúdo seja um objeto
                if (typeof updateData.content !== 'object' || updateData.content === null) {
                    updateData.content = {};
                    logger.warn('Conteúdo convertido para objeto vazio pois não estava no formato correto');
                }
            } catch (e) {
                logger.warn('Erro ao processar conteúdo:', e);
                return res.status(400).json({
                    error: 'Erro ao processar dados',
                    details: 'Formato inválido para o conteúdo'
                });
            }
        }
        
        // Se tiver nova imagem, atualizar imageUrl
        if (req.file) {
            // Se já existir uma imagem, excluir a antiga
            if (module.imageUrl) {
                const oldImagePath = path.join(__dirname, '../public', module.imageUrl);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                    logger.info(`Imagem antiga excluída: ${oldImagePath}`);
                }
            }
            
            updateData.imageUrl = `/uploads/modules/${req.file.filename}`;
            logger.info(`Nova imagem definida: ${updateData.imageUrl}`);
        }

        // Atualizar o módulo
        await module.update(updateData);
        logger.info(`Módulo ${req.params.id} atualizado com sucesso`);
        
        // Retornar o módulo atualizado
        const updatedModule = await module.reload();
        res.json(updatedModule);
    } catch (error) {
        logger.error('Erro ao atualizar módulo:', error);
        res.status(500).json({ 
            error: 'Erro ao atualizar módulo',
            details: error.message 
        });
    }
});

// Excluir módulo (apenas admin)
router.delete('/modules/:id', requireAdmin, async (req, res) => {
    try {
        const module = await LearningModule.findByPk(req.params.id);
        if (!module) {
            return res.status(404).json({ 
                error: 'Módulo não encontrado',
                details: `Módulo com ID '${req.params.id}' não existe`
            });
        }
        
        // Se o módulo tiver uma imagem, excluí-la
        if (module.imageUrl) {
            const imagePath = path.join(__dirname, '../public', module.imageUrl);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        await module.destroy();
        res.json({ success: true, message: 'Módulo excluído com sucesso' });
    } catch (error) {
        logger.error('Erro ao excluir módulo:', error);
        res.status(500).json({ 
            error: 'Erro ao excluir módulo',
            details: error.message 
        });
    }
});

// Atualizar apenas as seções do módulo (apenas admin)
router.put('/modules/:id/sections', requireAdmin, async (req, res) => {
    try {
        const module = await LearningModule.findByPk(req.params.id);
        if (!module) {
            return res.status(404).json({ 
                error: 'Módulo não encontrado',
                details: `Módulo com ID '${req.params.id}' não existe`
            });
        }

        // Validar que o corpo da requisição contém seções
        if (!req.body.sections) {
            return res.status(400).json({ 
                error: 'Dados inválidos',
                details: 'O campo sections é obrigatório'
            });
        }

        // Preparar dados para atualização
        let sections = req.body.sections;

        // Se enviado como string JSON, converter para objeto
        if (typeof sections === 'string') {
            try {
                sections = JSON.parse(sections);
            } catch (e) {
                logger.warn('Erro ao processar seções:', e);
                return res.status(400).json({ 
                    error: 'Dados inválidos',
                    details: 'O campo sections deve ser um JSON válido'
                });
            }
        }

        // Atualizar apenas as seções do módulo
        await module.update({
            sections: sections
        });
        
        res.json({ 
            success: true,
            message: 'Seções atualizadas com sucesso',
            module: await module.reload()
        });
    } catch (error) {
        logger.error('Erro ao atualizar seções do módulo:', error);
        res.status(500).json({ 
            error: 'Erro ao atualizar seções do módulo',
            details: error.message 
        });
    }
});

// Rotas de busca
router.get('/search', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ 
                error: 'Parâmetro inválido',
                details: 'query é obrigatório'
            });
        }

        const modules = await LearningModule.findAll();
        const results = [];

        for (const module of modules) {
            const searchTerms = query.toLowerCase().split(' ');
            
            // Verificar se o módulo tem seções e conteúdo
            if (!Array.isArray(module.sections) || !module.content || typeof module.content !== 'object') {
                continue;
            }
            
            // Buscar em títulos, conteúdo e keywords
            for (const section of module.sections) {
                if (!section || !Array.isArray(section.pages)) continue;
                
                for (const pageId of section.pages) {
                    if (typeof pageId !== 'string') continue;
                    
                    const page = module.content[pageId];
                    if (!page) continue;

                    const pageContent = page.content || '';
                    const pageTitle = page.title || '';
                    
                    const searchableText = `
                        ${module.title || ''} 
                        ${pageTitle} 
                        ${pageContent}
                        ${module.description || ''}
                        ${module.keywords?.join(' ') || ''}
                    `.toLowerCase();

                    // Verificar se algum termo de busca está presente
                    const matches = searchTerms.filter(term => 
                        searchableText.includes(term) && term.length > 2 // Ignorar termos muito curtos
                    );

                    if (matches.length > 0) {
                        // Usar o termo que aparece no conteúdo para extrair trecho
                        let termForExcerpt = matches[0];
                        
                        // Dar preferência a termos encontrados no conteúdo da página
                        for (const term of matches) {
                            if (pageContent.toLowerCase().includes(term)) {
                                termForExcerpt = term;
                                break;
                            }
                        }
                        
                        results.push({
                            moduleId: module.id,
                            moduleTitle: module.title || 'Sem título',
                            sectionTitle: section.title || 'Sem título',
                            pageId: pageId,
                            pageTitle: pageTitle || 'Sem título',
                            excerpt: getExcerpt(pageContent, termForExcerpt),
                            matches: matches,
                            keywords: module.keywords || [],
                            url: `${module.route || `/learn/${module.id}`}#${pageId}`
                        });
                    }
                }
            }
        }

        res.json(results);
    } catch (error) {
        logger.error('Erro na busca:', error);
        res.status(500).json({ 
            error: 'Erro ao realizar busca',
            details: error.message 
        });
    }
});

// Busca por palavras-chave
router.get('/search/keywords', async (req, res) => {
    try {
        const { query, moduleId } = req.query;
        
        if (!query) {
            return res.status(400).json({ 
                error: 'Parâmetro inválido',
                details: 'query é obrigatório'
            });
        }

        // Filtrar por ID de módulo se fornecido
        const queryOptions = {};
        if (moduleId) {
            queryOptions.where = { id: moduleId };
        }
        
        const modules = await LearningModule.findAll(queryOptions);
        const results = [];
        const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 1);

        for (const module of modules) {
            // Buscar palavras-chave no módulo
            const moduleKeywords = Array.isArray(module.keywords) ? module.keywords : [];
            const moduleKeywordMatches = moduleKeywords.filter(keyword => 
                searchTerms.some(term => keyword.toLowerCase().includes(term))
            );
            
            // Buscar em páginas
            const pagesWithKeywords = [];
            
            // Verificar se há conteúdo e seções
            if (module.content && module.sections) {
                // Para cada seção
                for (const section of module.sections) {
                    if (!section || !Array.isArray(section.pages)) continue;
                    
                    // Para cada página na seção
                    for (const pageId of section.pages) {
                        if (typeof pageId !== 'string') continue;
                        
                        const page = module.content[pageId];
                        if (!page) continue;
                        
                        // Verificar palavras-chave da página
                        const pageKeywords = Array.isArray(page.keywords) ? page.keywords : [];
                        
                        // Verificar se alguma palavra-chave corresponde aos termos de busca
                        const pageKeywordMatches = pageKeywords.filter(keyword => 
                            searchTerms.some(term => keyword.toLowerCase().includes(term))
                        );
                        
                        if (pageKeywordMatches.length > 0) {
                            pagesWithKeywords.push({
                                pageId,
                                title: page.title || 'Sem título',
                                section: section.title || 'Sem título',
                                keywords: pageKeywords,
                                matchingKeywords: pageKeywordMatches,
                                excerpt: `Palavras-chave: ${pageKeywordMatches.join(', ')}`
                            });
                        }
                    }
                }
            }
            
            // Se houver correspondências no módulo ou em qualquer página
            if (moduleKeywordMatches.length > 0 || pagesWithKeywords.length > 0) {
                results.push({
                    moduleId: module.id,
                    moduleTitle: module.title,
                    moduleDescription: module.description,
                    moduleKeywords: moduleKeywords,
                    matchingModuleKeywords: moduleKeywordMatches,
                    imageUrl: module.imageUrl,
                    pages: pagesWithKeywords,
                    url: module.route
                });
            }
        }

        res.json(results);
    } catch (error) {
        logger.error('Erro na busca por palavras-chave:', error);
        res.status(500).json({ 
            error: 'Erro ao realizar busca por palavras-chave',
            details: error.message 
        });
    }
});

// Rotas de administração
router.get('/admin/modules', requireAdmin, (req, res) => {
    try {
        res.sendFile(path.join(__dirname, '../public/modules/learning/templates/learn-admin.html'));
    } catch (error) {
        logger.error('Erro ao carregar página de admin:', error);
        res.status(500).send('Erro ao carregar página');
    }
});

router.get('/admin/module/new', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/modules/learning/templates/module-editor.html'));
});

router.get('/admin/module/edit/:id', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/modules/learning/templates/module-editor.html'));
});

router.get('/admin/module/content/:id', requireAdmin, (req, res) => {
    const moduleId = req.params.id;
    // Redirecionar para o editor com o ID como parâmetro na URL
    res.redirect(`/modules/learning/templates/module-content-editor.html?id=${moduleId}`);
});

// Função auxiliar para extrair trecho relevante do conteúdo
function getExcerpt(content, term, length = 200) {
    if (!content) return '';
    
    try {
        const lowerContent = content.toLowerCase();
        const termIndex = lowerContent.indexOf(term.toLowerCase());
        
        if (termIndex === -1) {
            return content.substring(0, length);
        }
        
        const start = Math.max(0, termIndex - length / 2);
        const end = Math.min(content.length, termIndex + term.length + length / 2);
        
        let excerpt = content.substring(start, end);
        
        // Adicionar elipses se necessário
        if (start > 0) excerpt = '...' + excerpt;
        if (end < content.length) excerpt = excerpt + '...';
        
        return excerpt;
    } catch (error) {
        logger.error('Erro ao gerar excerpt:', error);
        return '';
    }
}

// Obter todos os dados do módulo pelo ID (formato simplificado para o editor)
router.get('/modules/:id/full', requireAdmin, async (req, res) => {
    try {
        const moduleId = req.params.id;
        logger.info(`Buscando dados completos do módulo: ${moduleId}`);
        
        // Buscar módulo pelo ID
        const module = await LearningModule.findByPk(moduleId);
        
        if (!module) {
            logger.warn(`Módulo não encontrado: ${moduleId}`);
            return res.status(404).json({ 
                error: 'Módulo não encontrado',
                details: `Módulo com ID '${moduleId}' não existe`
            });
        }
        
        // Garantir que sections seja um array
        if (!Array.isArray(module.sections)) {
            module.sections = [];
            logger.warn(`Módulo ${moduleId} não possui seções ou seções em formato inválido`);
        }
        
        // Garantir que content seja um objeto
        if (typeof module.content !== 'object' || module.content === null) {
            module.content = {};
            logger.warn(`Módulo ${moduleId} não possui conteúdo ou conteúdo em formato inválido`);
        }
        
        // Preencher dados do módulo
        const moduleData = {
            id: module.id,
            title: module.title,
            description: module.description || '',
            imageUrl: module.imageUrl || '',
            sections: module.sections,
            content: module.content,
            status: module.status || 'draft',
            keywords: Array.isArray(module.keywords) ? module.keywords : []
        };
        
        logger.info(`Dados do módulo ${moduleId} enviados com sucesso`);
        res.json(moduleData);
    } catch (error) {
        logger.error('Erro ao buscar dados do módulo:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar dados do módulo',
            details: error.message 
        });
    }
});

module.exports = router; 