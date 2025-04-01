const express = require('express');
const router = express.Router();
const { Content } = require('../models/postgresql');
const logger = require('../utils/logger');

// Buscar conteúdo
router.get('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        let content = await Content.findOne({
            where: { type }
        });

        if (!content) {
            // Criar conteúdo inicial se não existir
            content = await Content.create({
                type,
                content: {},
                sections: []
            });
        }

        res.json({
            content: content.content,
            sections: content.sections
        });
    } catch (error) {
        logger.error('Erro ao buscar conteúdo:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar conteúdo',
            details: error.message 
        });
    }
});

// Salvar conteúdo
router.post('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { content, sections } = req.body;

        const [contentDoc, created] = await Content.upsert({
            type,
            content,
            sections
        }, {
            returning: true
        });

        res.json({
            success: true,
            content: contentDoc
        });
    } catch (error) {
        logger.error('Erro ao salvar conteúdo:', error);
        res.status(500).json({ 
            error: 'Erro ao salvar conteúdo',
            details: error.message 
        });
    }
});

module.exports = router; 