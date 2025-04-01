'use strict';

const { LearningModule, LearningPage } = require('../models');

class LearningController {
    async getContent(req, res) {
        try {
            const { type } = req.params;
            
            const module = await LearningModule.findOne({
                where: { name: type },
                include: [{
                    model: LearningPage,
                    as: 'pages',
                    attributes: ['id', 'title', 'content', 'order']
                }]
            });

            if (!module) {
                return res.status(404).json({
                    error: 'Módulo não encontrado'
                });
            }

            // Organizar o conteúdo
            const content = {};
            const sections = [{
                id: 'main',
                name: 'Principal',
                pages: []
            }];

            // Organizar páginas por seção
            module.pages.forEach(page => {
                content[page.id] = {
                    title: page.title,
                    content: page.content
                };
                sections[0].pages.push(page.id);
            });

            return res.json({
                content,
                sections
            });

        } catch (error) {
            console.error('Erro ao buscar conteúdo:', error);
            return res.status(500).json({
                error: 'Erro interno ao buscar conteúdo'
            });
        }
    }
}

module.exports = new LearningController(); 