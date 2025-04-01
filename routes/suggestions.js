const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Suggestion } = require('../models/postgresql/associations');
const multer = require('multer');
const path = require('path');
const logger = require('../utils/logger');
const authMiddleware = require('../middlewares/auth');

// Configuração do multer para upload de imagens
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Listar sugestões
router.get('/', authMiddleware, async (req, res) => {
    try {
        const suggestions = await Suggestion.findAll({
            order: [
                ['upvotes', 'DESC'],
                ['created_at', 'DESC']
            ]
        });
        res.json(suggestions);
    } catch (error) {
        logger.error('Erro ao buscar sugestões:', error);
        res.status(500).json({ error: 'Erro ao buscar sugestões' });
    }
});

// Criar sugestão
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const { description, category, createdBy } = req.body;
        const imageUrl = req.file ? req.file.path : null;

        // Gerar número sequencial
        const lastSuggestion = await Suggestion.findOne({
            order: [['sequential_number', 'DESC']]
        });
        
        const sequentialNumber = lastSuggestion ? lastSuggestion.sequentialNumber + 1 : 1;

        const suggestion = await Suggestion.create({
            sequentialNumber,
            description,
            category,
            createdBy,
            imageUrl
        });

        res.status(201).json(suggestion);
    } catch (error) {
        console.error('Erro ao criar sugestão:', error);
        res.status(500).json({ error: 'Erro ao criar sugestão' });
    }
});

// Atualizar status
router.patch('/:id/status', async (req, res) => {
    try {
        const suggestion = await Suggestion.findByPk(req.params.id);
        if (!suggestion) {
            return res.status(404).json({ error: 'Sugestão não encontrada' });
        }

        await suggestion.update({ status: req.body.status });
        res.json(suggestion);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

// Votar em uma sugestão
router.post('/:id/vote', async (req, res) => {
    try {
        const { userId, voteType } = req.body;
        const suggestion = await Suggestion.findByPk(req.params.id);

        if (!suggestion) {
            return res.status(404).json({ error: 'Sugestão não encontrada' });
        }

        const votedBy = suggestion.votedBy || [];
        const existingVote = votedBy.find(vote => vote.userId === userId);

        if (existingVote) {
            if (existingVote.voteType === voteType) {
                suggestion.votedBy = votedBy.filter(vote => vote.userId !== userId);
                suggestion[`${voteType}votes`] = Math.max(0, suggestion[`${voteType}votes`] - 1);
            } else {
                existingVote.voteType = voteType;
                suggestion[`${voteType}votes`]++;
                suggestion[`${voteType === 'up' ? 'down' : 'up'}votes`]--;
            }
        } else {
            suggestion.votedBy = [...votedBy, { userId, voteType }];
            suggestion[`${voteType}votes`]++;
        }

        await suggestion.save();
        res.json(suggestion);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao processar voto' });
    }
});

// Adicionar comentário
router.post('/:id/comments', async (req, res) => {
    try {
        const suggestion = await Suggestion.findByPk(req.params.id);
        if (!suggestion) {
            return res.status(404).json({ error: 'Sugestão não encontrada' });
        }

        await suggestion.update({
            comments: {
                text: req.body.text,
                author: req.body.author
            }
        });
        res.json(suggestion);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao adicionar comentário' });
    }
});

// Buscar comentários de uma sugestão
router.get('/:id/comments', async (req, res) => {
    try {
        const suggestion = await Suggestion.findByPk(req.params.id);
        if (!suggestion) {
            return res.status(404).json({ error: 'Sugestão não encontrada' });
        }
        res.json(suggestion.comments || []);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar comentários' });
    }
});

// Excluir sugestão
router.delete('/:id', async (req, res) => {
    try {
        const suggestion = await Suggestion.findByPk(req.params.id);
        if (!suggestion) {
            return res.status(404).json({ error: 'Sugestão não encontrada' });
        }
        await suggestion.destroy();
        res.json({ message: 'Sugestão excluída com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir sugestão' });
    }
});

module.exports = router; 