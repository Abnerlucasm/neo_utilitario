const express = require('express');
const router = express.Router();
const { UserProgress, LearningModule, User } = require('../models/postgresql/associations');
const logger = require('../utils/logger');
const { sequelize } = require('../models/postgresql/associations');
const { v4: uuidv4 } = require('uuid');
const { UserAchievement } = require('../models/postgresql');
const auth = require('../middlewares/auth');
const { Op } = require('sequelize');

// Middleware para garantir autenticação em todas as rotas
router.use(auth);

// Obter progresso do usuário para um módulo específico
router.get('/:moduleId', async (req, res) => {
    try {
        const { moduleId } = req.params;
        
        // Obter ID do usuário autenticado do token JWT
        const userId = req.user.id;
        
        if (!userId) {
            return res.status(401).json({
                error: 'Usuário não autenticado',
                message: 'Você precisa estar autenticado para acessar o progresso'
            });
        }

        logger.info(`Buscando progresso para usuário ${userId} no módulo ${moduleId}`);

        // Verificar se o módulo existe
        const module = await LearningModule.findByPk(moduleId);
        if (!module) {
            return res.status(404).json({
                error: 'Módulo não encontrado',
                message: `Módulo com ID '${moduleId}' não existe`
            });
        }

        let progress;
        try {
            progress = await UserProgress.findOne({
                where: {
                    user_id: userId,
                    module_id: moduleId
                }
            });
        } catch (dbError) {
            logger.error(`Erro ao buscar progresso no banco: ${dbError.message}`, dbError);
            // Continuar e retornar progresso padrão em caso de erro
        }

        // Se não encontrou progresso, retornar um progresso vazio
        if (!progress) {
            logger.info(`Nenhum progresso encontrado para usuário ${userId} no módulo ${moduleId}, retornando vazio`);
            return res.json({
                user_id: userId,
                module_id: moduleId,
                completed_pages: [],
                total_pages: 0,
                progress: 0
            });
        }

        res.json(progress);
    } catch (error) {
        logger.error('Erro ao buscar progresso:', error);
        // Retornar um status 200 com progresso vazio em vez de erro 500
        res.json({
            completed_pages: [],
            total_pages: 0,
            progress: 0,
            error: error.message
        });
    }
});

// Obter progresso do usuário para todos os módulos
router.get('/', async (req, res) => {
    try {
        // Obter ID do usuário autenticado do token JWT
        const userId = req.user.id;
        
        if (!userId) {
            return res.status(401).json({
                error: 'Usuário não autenticado',
                message: 'Você precisa estar autenticado para acessar o progresso'
            });
        }

        logger.info(`Buscando progresso para todos os módulos do usuário ${userId}`);

        // Buscar progresso para todos os módulos
        const progressItems = await UserProgress.findAll({
            where: {
                user_id: userId
            },
            include: [{
                model: LearningModule,
                as: 'module',
                attributes: ['id', 'title', 'status', 'imageUrl', 'description']
            }]
        });

        // Calcular estatísticas de progresso
        const totalModules = await LearningModule.count({
            where: {
                status: 'published'
            }
        });

        // Formatar progresso para o formato esperado pelo frontend
        const moduleProgressItems = progressItems.map(p => ({
            module_id: p.module_id,
            title: p.module?.title || 'Módulo sem título',
            completed_pages: p.completed_pages.length,
            total_pages: p.total_pages,
            progress: p.progress,
            completed: p.completed,
            last_accessed: p.last_accessed,
            imageUrl: p.module?.imageUrl
        }));

        // Estrutura esperada pelo frontend
        const response = {
            totalModules,
            startedModules: progressItems.length,
            completedModules: progressItems.filter(p => p.completed).length,
            modules: moduleProgressItems
        };

        res.json(response);
    } catch (error) {
        logger.error('Erro ao buscar progresso de todos os módulos:', error);
        res.status(500).json({
            error: 'Erro ao buscar progresso',
            message: error.message
        });
    }
});

// Atualizar progresso
router.post('/:moduleId', async (req, res) => {
    try {
        const { moduleId } = req.params;
        
        // Obter ID do usuário autenticado do token JWT
        const userId = req.user.id;
        
        if (!userId) {
            return res.status(401).json({
                error: 'Usuário não autenticado',
                message: 'Você precisa estar autenticado para atualizar o progresso'
            });
        }
        
        // Aceitar tanto nome em camelCase quanto snake_case para maior flexibilidade
        const completedPages = req.body.completed_pages || req.body.completedPages || [];
        const totalPages = req.body.total_pages || req.body.totalPages || 0;
        
        logger.info('Dados recebidos para atualização de progresso:', {
            moduleId,
            userId,
            completedPagesCount: Array.isArray(completedPages) ? completedPages.length : 'inválido',
            totalPages
        });

        // Verificar se o módulo existe
        const module = await LearningModule.findByPk(moduleId);
        if (!module) {
            return res.status(404).json({
                error: 'Módulo não encontrado',
                message: `Módulo com ID '${moduleId}' não existe`
            });
        }

        // Verificar se os dados são válidos
        if (!Array.isArray(completedPages)) {
            return res.status(400).json({
                error: 'Dados inválidos',
                message: 'completed_pages deve ser um array'
            });
        }

        // Calcular valor de progresso percentual
        const progressValue = (totalPages > 0) ? (completedPages.length / totalPages) * 100 : 0;
        
        // Verificar se todas as páginas foram completadas
        const completed = (totalPages > 0) && (completedPages.length >= totalPages);
        
        // Data de conclusão se o módulo foi completado agora
        const completionDate = completed ? new Date() : null;

        // Atualizar ou criar registro de progresso
        try {
            // Verificar se o usuário existe
            const user = await User.findByPk(userId);
            
            if (!user) {
                return res.status(404).json({
                    error: 'Usuário não encontrado',
                    message: 'O usuário não foi encontrado no sistema'
                });
            }
            
            // Atualizar ou criar registro de progresso
            const [progress, created] = await UserProgress.upsert({
                user_id: userId,
                module_id: moduleId,
                completed_pages: completedPages,
                total_pages: totalPages,
                progress: progressValue,
                completed: completed,
                completion_date: completionDate,
                last_accessed: new Date()
            }, {
                returning: true
            });
            
            res.json({
                ...progress.get({ plain: true }),
                created
            });
        } catch (dbError) {
            logger.error(`Erro ao salvar progresso no banco: ${dbError.message}`, dbError);
            res.status(500).json({
                error: 'Erro ao salvar progresso',
                message: dbError.message
            });
        }
    } catch (error) {
        logger.error('Erro ao atualizar progresso:', error);
        res.status(500).json({ 
            error: 'Erro ao atualizar progresso',
            message: error.message 
        });
    }
});

// Obter progresso geral do usuário
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        
        logger.info(`Buscando progresso para o usuário: ${userId}`);
        
        // Buscar todo o progresso do usuário
        const userProgress = await UserProgress.findAll({
            where: { user_id: userId }
        });
        
        // Processar dados para envio
        const progress = {
            user_id: userId,
            modules: userProgress.map(progress => ({
                module_id: progress.module_id,
                total_pages: progress.total_pages,
                completed_pages: progress.completed_pages,
                progress: progress.progress,
                completed: progress.completed,
                last_access: progress.updatedAt
            }))
        };
        
        res.json(progress);
    } catch (error) {
        logger.error('Erro ao buscar progresso do usuário:', error);
        res.status(500).json({ error: 'Erro ao buscar progresso' });
    }
});

// Obter progresso de um módulo específico
router.get('/modules/:moduleId', async (req, res) => {
    try {
        const userId = req.user.id;
        const moduleId = req.params.moduleId;
        
        logger.info(`Buscando progresso do módulo ${moduleId} para o usuário ${userId}`);
        
        let progress = await UserProgress.findOne({
            where: {
                user_id: userId,
                module_id: moduleId
            }
        });
        
        if (!progress) {
            // Se não existir, criar um novo registro de progresso
            progress = {
                user_id: userId,
                module_id: moduleId,
                completed_pages: [],
                total_pages: 0,
                progress: 0,
                completed: false
            };
        } else {
            // Garantir que completed_pages é um array
            if (!Array.isArray(progress.completed_pages)) {
                progress.completed_pages = [];
            }
        }
        
        res.json(progress);
    } catch (error) {
        logger.error(`Erro ao buscar progresso do módulo ${req.params.moduleId}:`, error);
        res.status(500).json({ error: 'Erro ao buscar progresso do módulo' });
    }
});

// Marcar um módulo como iniciado
router.post('/modules/:moduleId/start', async (req, res) => {
    try {
        const userId = req.user.id;
        const moduleId = req.params.moduleId;
        
        logger.info(`Marcando módulo ${moduleId} como iniciado para o usuário ${userId}`);
        
        // Verificar se já existe um registro de progresso
        let progress = await UserProgress.findOne({
            where: {
                user_id: userId,
                module_id: moduleId
            }
        });
        
        if (!progress) {
            // Se não existir, criar um novo registro
            progress = await UserProgress.create({
                user_id: userId,
                module_id: moduleId,
                completed_pages: [],
                total_pages: req.body.total_pages || 0,
                progress: 0,
                completed: false
            });
            
            logger.info(`Novo progresso criado para o módulo ${moduleId}`);
        }
        
        res.json(progress);
    } catch (error) {
        logger.error(`Erro ao marcar módulo ${req.params.moduleId} como iniciado:`, error);
        res.status(500).json({ error: 'Erro ao registrar início do módulo' });
    }
});

// Marcar uma página como lida
router.post('/modules/:moduleId/pages/:pageId', async (req, res) => {
    try {
        const userId = req.user.id;
        const moduleId = req.params.moduleId;
        const pageId = req.params.pageId;
        
        logger.info(`Marcando página ${pageId} do módulo ${moduleId} como lida para o usuário ${userId}`);
        
        // Buscar ou criar progresso
        let [progress, created] = await UserProgress.findOrCreate({
            where: {
                user_id: userId,
                module_id: moduleId
            },
            defaults: {
                completed_pages: [],
                total_pages: req.body.total_pages || 0,
                progress: 0,
                completed: false
            }
        });
        
        // Garantir que completed_pages é um array
        let completedPages = Array.isArray(progress.completed_pages) 
            ? [...progress.completed_pages] 
            : [];
        
        // Verificar se a página já foi marcada como lida
        if (!completedPages.includes(pageId)) {
            completedPages.push(pageId);
            
            // Atualizar progresso
            const totalPages = Math.max(progress.total_pages, completedPages.length);
            const progressPercentage = Math.round((completedPages.length / totalPages) * 100);
            const completed = progressPercentage >= 100;
            
            // Salvar alterações
            progress.completed_pages = completedPages;
            progress.total_pages = totalPages;
            progress.progress = progressPercentage;
            progress.completed = completed;
            
            await progress.save();
            
            logger.info(`Progresso atualizado: ${completedPages.length}/${totalPages} (${progressPercentage}%)`);
            
            // Verificar conquistas
            if (completed) {
                await checkAndCreateAchievement(userId, 'module_completed');
            }
            
            // Verificar primeira página lida (para conquista de primeiro módulo iniciado)
            if (completedPages.length === 1) {
                await checkAndCreateAchievement(userId, 'module_started');
            }
        }
        
        res.json(progress);
    } catch (error) {
        logger.error(`Erro ao marcar página como lida:`, error);
        res.status(500).json({ error: 'Erro ao atualizar progresso' });
    }
});

// Verificar e criar conquistas
async function checkAndCreateAchievement(userId, achievementType) {
    try {
        const achievementTypes = {
            module_started: {
                name: 'Primeiro Passo',
                description: 'Comece seu primeiro módulo de aprendizado',
                type: 'module_started',
                icon: 'fas fa-flag-checkered',
                color: 'is-info'
            },
            module_completed: {
                name: 'Missão Cumprida',
                description: 'Complete seu primeiro módulo de aprendizado',
                type: 'module_completed',
                icon: 'fas fa-trophy',
                color: 'is-success'
            },
            five_modules_started: {
                name: 'Explorador',
                description: 'Inicie 5 módulos diferentes',
                type: 'five_modules_started',
                icon: 'fas fa-compass',
                color: 'is-link'
            },
            three_modules_completed: {
                name: 'Especialista', 
                description: 'Complete 3 módulos de aprendizado',
                type: 'three_modules_completed',
                icon: 'fas fa-award',
                color: 'is-warning'
            },
            fifty_pages: {
                name: 'Leitor Ávido',
                description: 'Leia 50 páginas de conteúdo',
                type: 'fifty_pages',
                icon: 'fas fa-book-reader',
                color: 'is-danger'
            },
            favorite_module: {
                name: 'Colecionador',
                description: 'Favorite seu primeiro módulo',
                type: 'favorite_module',
                icon: 'fas fa-star',
                color: 'is-warning'
            }
        };
        
        // Verificar se o usuário já possui esta conquista
        const existingAchievement = await UserAchievement.findOne({
            where: {
                user_id: userId,
                type: achievementType
            }
        });
        
        if (existingAchievement) {
            logger.info(`Usuário ${userId} já possui a conquista ${achievementType}`);
            return null;
        }
        
        // Verificar conquistas adicionais baseadas em contagem
        if (achievementType === 'module_started' || achievementType === 'module_completed') {
            // Contar quantos módulos o usuário já iniciou/completou
            const progress = await UserProgress.findAll({
                where: {
                    user_id: userId
                }
            });
            
            const modulesStarted = progress.length;
            const modulesCompleted = progress.filter(p => p.completed).length;
            
            if (modulesStarted >= 5) {
                await createAchievement(userId, 'five_modules_started');
            }
            
            if (modulesCompleted >= 3) {
                await createAchievement(userId, 'three_modules_completed');
            }
            
            // Contar total de páginas lidas
            const totalPagesRead = progress.reduce((total, p) => {
                return total + (Array.isArray(p.completed_pages) ? p.completed_pages.length : 0);
            }, 0);
            
            if (totalPagesRead >= 50) {
                await createAchievement(userId, 'fifty_pages');
            }
        }
        
        // Criar a conquista solicitada
        return await createAchievement(userId, achievementType);
    } catch (error) {
        logger.error(`Erro ao verificar conquistas:`, error);
        return null;
    }
}

// Função auxiliar para criar conquistas
async function createAchievement(userId, achievementType) {
    const achievementTypes = {
        module_started: {
            name: 'Primeiro Passo',
            description: 'Comece seu primeiro módulo de aprendizado',
            type: 'module_started',
            icon: 'fas fa-flag-checkered',
            color: 'is-info'
        },
        module_completed: {
            name: 'Missão Cumprida',
            description: 'Complete seu primeiro módulo de aprendizado',
            type: 'module_completed',
            icon: 'fas fa-trophy',
            color: 'is-success'
        },
        five_modules_started: {
            name: 'Explorador',
            description: 'Inicie 5 módulos diferentes',
            type: 'five_modules_started',
            icon: 'fas fa-compass',
            color: 'is-link'
        },
        three_modules_completed: {
            name: 'Especialista', 
            description: 'Complete 3 módulos de aprendizado',
            type: 'three_modules_completed',
            icon: 'fas fa-award',
            color: 'is-warning'
        },
        fifty_pages: {
            name: 'Leitor Ávido',
            description: 'Leia 50 páginas de conteúdo',
            type: 'fifty_pages',
            icon: 'fas fa-book-reader',
            color: 'is-danger'
        },
        favorite_module: {
            name: 'Colecionador',
            description: 'Favorite seu primeiro módulo',
            type: 'favorite_module',
            icon: 'fas fa-star',
            color: 'is-warning'
        }
    };
    
    // Verificar se o tipo de conquista é válido
    if (!achievementTypes[achievementType]) {
        logger.error(`Tipo de conquista inválido: ${achievementType}`);
        return null;
    }
    
    // Verificar se o usuário já possui esta conquista
    const existingAchievement = await UserAchievement.findOne({
        where: {
            user_id: userId,
            type: achievementType
        }
    });
    
    if (existingAchievement) {
        logger.info(`Usuário ${userId} já possui a conquista ${achievementType}`);
        return existingAchievement;
    }
    
    // Criar nova conquista
    const achievementData = achievementTypes[achievementType];
    const newAchievement = await UserAchievement.create({
        user_id: userId,
        name: achievementData.name,
        description: achievementData.description,
        type: achievementType,
        icon: achievementData.icon,
        color: achievementData.color,
        awarded_at: new Date()
    });
    
    logger.info(`Nova conquista criada para o usuário ${userId}: ${achievementType}`);
    return newAchievement;
}

// Obter conquistas do usuário
router.get('/achievements', async (req, res) => {
    try {
        const userId = req.user.id;
        
        logger.info(`Buscando conquistas para o usuário: ${userId}`);
        
        const achievements = await UserAchievement.findAll({
            where: { user_id: userId },
            order: [['awarded_at', 'DESC']]
        });
        
        res.json(achievements);
    } catch (error) {
        logger.error('Erro ao buscar conquistas do usuário:', error);
        res.status(500).json({ error: 'Erro ao buscar conquistas' });
    }
});

// Sincronizar com favoritos do módulo
router.post('/favorites/sync', async (req, res) => {
    try {
        const userId = req.user.id;
        const { favorites } = req.body;
        
        if (!Array.isArray(favorites)) {
            return res.status(400).json({ error: 'O parâmetro favorites deve ser um array' });
        }
        
        logger.info(`Sincronizando ${favorites.length} favoritos para o usuário ${userId}`);
        
        // Verificar se o usuário tem a conquista de favoritar módulo
        if (favorites.length > 0) {
            await checkAndCreateAchievement(userId, 'favorite_module');
        }
        
        res.json({ success: true, message: 'Favoritos sincronizados com sucesso' });
    } catch (error) {
        logger.error('Erro ao sincronizar favoritos:', error);
        res.status(500).json({ error: 'Erro ao sincronizar favoritos' });
    }
});

module.exports = router; 