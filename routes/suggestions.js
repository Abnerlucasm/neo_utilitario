const express = require('express');
const router = express.Router();
const Suggestion = require('../models/suggestion');

// Listar todas as sugestões
router.get('/suggestions', async (req, res) => {
    try {
        const { sort = '-createdAt' } = req.query;
        let sortQuery = {};
        
        switch (sort) {
            case 'votes':
                // Ordenar por votos (upvotes - downvotes) descendente
                sortQuery = { $subtract: ['$upvotes', '$downvotes'] };
                break;
            case 'date':
                sortQuery = { createdAt: -1 };
                break;
            case '-date':
                sortQuery = { createdAt: 1 };
                break;
            default:
                sortQuery = { createdAt: -1 };
        }

        const suggestions = await Suggestion.aggregate([
            {
                $addFields: {
                    voteScore: { $subtract: ['$upvotes', '$downvotes'] }
                }
            },
            {
                $sort: {
                    voteScore: -1, // Primeiro ordena por votos
                    createdAt: -1  // Depois por data
                }
            }
        ]);

        res.json(suggestions);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar sugestões' });
    }
});

// Criar nova sugestão
router.post('/suggestions', async (req, res) => {
    try {
        const { title, description, category, priority, createdBy } = req.body;
        
        // Verificar se todos os campos obrigatórios estão presentes
        if (!title || !description || !category || !priority || !createdBy) {
            return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
        }

        // Gerar número sequencial
        const lastSuggestion = await Suggestion.findOne({}, {}, { sort: { sequentialNumber: -1 } });
        const sequentialNumber = lastSuggestion ? lastSuggestion.sequentialNumber + 1 : 1;

        const suggestion = new Suggestion({
            sequentialNumber,
            title,
            description,
            category,
            priority,
            createdBy,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        await suggestion.save();
        res.status(201).json(suggestion);
    } catch (error) {
        console.error('Erro ao criar sugestão:', error); // Adicionar log de erro
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

// Atualizar voto
router.post('/suggestions/:id/vote', async (req, res) => {
    try {
        const { userId, voteType } = req.body;
        const suggestion = await Suggestion.findById(req.params.id);
        
        if (!suggestion) {
            return res.status(404).json({ error: 'Sugestão não encontrada' });
        }

        // Encontrar voto existente do usuário
        const existingVote = suggestion.votedBy.find(vote => vote.userId === userId);

        if (existingVote) {
            // Se o voto é do mesmo tipo, remover o voto
            if (existingVote.voteType === voteType) {
                suggestion.votedBy = suggestion.votedBy.filter(vote => vote.userId !== userId);
                suggestion[`${voteType}votes`] = Math.max(0, suggestion[`${voteType}votes`] - 1);
            } else {
                // Se o voto é diferente, trocar o tipo do voto
                existingVote.voteType = voteType;
                suggestion[`${voteType}votes`]++;
                suggestion[`${voteType === 'up' ? 'down' : 'up'}votes`]--;
            }
        } else {
            // Adicionar novo voto
            suggestion.votedBy.push({ userId, voteType });
            suggestion[`${voteType}votes`]++;
        }

        await suggestion.save();
        res.json(suggestion);
    } catch (error) {
        console.error('Erro ao processar voto:', error);
        res.status(500).json({ error: 'Erro ao processar voto' });
    }
});

// Adicionar comentário
router.post('/suggestions/:id/comments', async (req, res) => {
    try {
        const suggestion = await Suggestion.findByIdAndUpdate(
            req.params.id,
            { 
                $push: { 
                    comments: {
                        text: req.body.text,
                        author: req.body.author
                    }
                }
            },
            { new: true }
        );
        res.json(suggestion);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao adicionar comentário' });
    }
});

// Buscar comentários de uma sugestão
router.get('/suggestions/:id/comments', async (req, res) => {
    try {
        const suggestion = await Suggestion.findById(req.params.id);
        if (!suggestion) {
            return res.status(404).json({ error: 'Sugestão não encontrada' });
        }
        res.json(suggestion.comments || []);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar comentários' });
    }
});

module.exports = router; 