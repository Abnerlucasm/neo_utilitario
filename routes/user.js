const express = require('express');
const router = express.Router();
const { User, Role } = require('../models/postgresql/associations');
const auth = require('../middlewares/auth');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Middleware de autenticação
router.use(auth);

// Configuração do multer para upload de avatar
const avatarStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Caminho absoluto para garantir que salva em /public/uploads/avatars
        const uploadDir = path.join(__dirname, '../public/uploads/avatars');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, `${req.user.id}${ext}`);
    }
});
const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Apenas arquivos de imagem são permitidos'));
        }
        cb(null, true);
    }
});

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

// Upload de avatar do usuário autenticado
router.post('/avatar', uploadAvatar.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }
        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        // Salvar caminho relativo do avatar (para uso no frontend)
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        user.avatar = avatarUrl;
        await user.save();
        res.json({ success: true, avatarUrl });
    } catch (error) {
        logger.error('Erro ao salvar avatar:', error);
        res.status(500).json({ error: 'Erro ao salvar avatar', details: error.message });
    }
});

module.exports = router;