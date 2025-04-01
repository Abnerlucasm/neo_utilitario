const express = require('express');
const router = express.Router();
const { User, Role } = require('../models/postgresql/associations');
const auth = require('../middlewares/auth');
const logger = require('../utils/logger');

// Middleware de autenticação
router.use(auth);

// Obter perfil do usuário atual
router.get('/profile', async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            include: [
                {
                    model: Role,
                    as: 'userRoles',
                    through: { attributes: [] }
                }
            ]
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json(user);
    } catch (error) {
        logger.error('Erro ao buscar perfil do usuário:', error);
        res.status(500).json({ error: 'Erro ao buscar perfil do usuário' });
    }
});

// Atualizar perfil do usuário
router.put('/profile', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const user = await User.findByPk(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Atualizar campos
        if (name) user.name = name;
        if (email) user.email = email;
        if (password) user.password = password;

        await user.save();
        res.json(user);
    } catch (error) {
        logger.error('Erro ao atualizar perfil:', error);
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
});

// Obter configurações do usuário
router.get('/settings', async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json({
            name: user.name || user.username,
            theme: user.theme || 'light',
            email: user.email
        });
    } catch (error) {
        logger.error('Erro ao buscar configurações:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar configurações',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Atualizar configurações do usuário
router.post('/settings', async (req, res) => {
    try {
        const { name, theme, password } = req.body;
        
        logger.debug('Atualizando configurações:', { 
            userId: req.user.id,
            hasName: !!name,
            hasTheme: !!theme,
            hasPassword: !!password
        });

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        if (name) user.name = name;
        if (theme) user.theme = theme;
        if (password) user.password = password;

        await user.save();

        res.json({
            success: true,
            message: 'Configurações atualizadas com sucesso',
            user: {
                name: user.name,
                theme: user.theme
            }
        });
    } catch (error) {
        logger.error('Erro ao atualizar configurações:', error);
        res.status(500).json({ 
            error: 'Erro ao atualizar configurações',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router; 