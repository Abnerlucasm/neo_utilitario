const express = require('express');
const router = express.Router();
const Suggestion = require('../models/suggestion');

// Listar todas as sugestões
router.get('/suggestions', async (req, res) => {
    try {
        const suggestions = await Suggestion.find().sort('-createdAt');
        res.json(suggestions);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar sugestões' });
    }
});

// Criar nova sugestão
router.post('/suggestions', async (req, res) => {
    try {
        const suggestion = new Suggestion({
            ...req.body,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        await suggestion.save();
        res.status(201).json(suggestion);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar sugestão' });
    }
});

// Atualizar status da sugestão
router.patch('/suggestions/:id/status', async (req, res) => {
    try {
        const suggestion = await Suggestion.findByIdAndUpdate(
            req.params.id,
            { 
                status: req.body.status,
                updatedAt: new Date()
            },
            { new: true }
        );
        res.json(suggestion);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

module.exports = router; 