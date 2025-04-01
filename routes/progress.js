const express = require('express');
const router = express.Router();
const { UserProgress, LearningModule } = require('../models/postgresql/associations');
const logger = require('../utils/logger');
const { sequelize } = require('../models/postgresql/associations');
const { v4: uuidv4 } = require('uuid');

// UUID fixo para o usuário padrão "default" - sempre usar o mesmo para consistência
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';

const usePostgres = process.env.USE_POSTGRES === 'true';

// Obter progresso do usuário
router.get('/:contentType', async (req, res) => {
    try {
        const { contentType } = req.params;
        // Usar um UUID válido para o usuário padrão
        const userId = DEFAULT_USER_ID;

        // Verificar se o módulo existe
        const module = await LearningModule.findByPk(contentType);
        if (!module) {
            return res.status(404).json({
                error: 'Módulo não encontrado',
                message: `Módulo com ID '${contentType}' não existe`
            });
        }

        let progress;
        try {
            if (usePostgres) {
                progress = await UserProgress.findOne({
                    where: {
                        user_id: userId,
                        module_id: contentType
                    }
                });
            } else {
                progress = await MongoUserProgress.findOne({
                    userId,
                    contentType
                });
            }
        } catch (dbError) {
            logger.error(`Erro ao buscar progresso no banco: ${dbError.message}`, dbError);
            // Continuar e retornar progresso padrão em caso de erro
        }

        // Se não encontrou progresso, retornar um progresso vazio
        if (!progress) {
            logger.info(`Nenhum progresso encontrado para módulo ${contentType}, retornando vazio`);
            return res.json({
                user_id: userId,
                module_id: contentType,
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

// Atualizar progresso
router.post('/:contentType', async (req, res) => {
    try {
        const { contentType } = req.params;
        // Aceitar tanto nome em camelCase quanto snake_case para maior flexibilidade
        const completedPages = req.body.completed_pages || req.body.completedPages || [];
        const totalPages = req.body.total_pages || req.body.totalPages || 0;
        
        // Usar um UUID válido para o usuário padrão
        const userId = DEFAULT_USER_ID;
        
        console.log('Dados recebidos para atualização de progresso:', {
            contentType,
            userId,
            completedPages: Array.isArray(completedPages) ? completedPages.length : 'inválido',
            totalPages
        });

        // Verificar se o módulo existe
        const module = await LearningModule.findByPk(contentType);
        if (!module) {
            return res.status(404).json({
                error: 'Módulo não encontrado',
                message: `Módulo com ID '${contentType}' não existe`
            });
        }

        // Verificar se os dados são válidos
        if (!Array.isArray(completedPages)) {
            return res.status(400).json({
                error: 'Dados inválidos',
                message: 'completed_pages deve ser um array'
            });
        }

        const progressValue = (totalPages > 0) ? (completedPages.length / totalPages) * 100 : 0;

        let result;
        try {
            if (usePostgres) {
                // Verificar se o usuário "default" já existe, e se não, criar um
                const [defaultUser] = await sequelize.query(
                    `SELECT id FROM users WHERE id = :id`,
                    {
                        replacements: { id: userId },
                        type: sequelize.QueryTypes.SELECT
                    }
                );
                
                if (!defaultUser) {
                    console.log('Criando usuário padrão para teste');
                    await sequelize.query(
                        `INSERT INTO users (id, name, email, created_at, updated_at) 
                         VALUES (:id, 'Usuário Padrão', 'default@example.com', NOW(), NOW())`,
                        {
                            replacements: { id: userId },
                            type: sequelize.QueryTypes.INSERT
                        }
                    );
                }
                
                [result] = await UserProgress.upsert({
                    user_id: userId,
                    module_id: contentType,
                    completed_pages: completedPages,
                    total_pages: totalPages,
                    progress: progressValue,
                    last_accessed: new Date()
                });
            } else {
                result = await MongoUserProgress.findOneAndUpdate(
                    { userId, contentType },
                    {
                        completedPages,
                        totalPages,
                        progress: progressValue,
                        lastAccessed: new Date()
                    },
                    { new: true, upsert: true }
                );
            }
            
            res.json(result);
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

module.exports = router; 