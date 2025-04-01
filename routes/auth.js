'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, Role, Resource } = require('../models/postgresql/associations');
const auth = require('../middlewares/auth');
const { requireAuth } = require('../middlewares/access-control');
const { sendVerificationEmail } = require('../services/email');
const { generateTwoFactorSecret, verifyTwoFactorToken } = require('../services/twoFactor');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        logger.info('Tentativa de login:', { email });

        if (!email || !password) {
            logger.warn('Tentativa de login sem email ou senha');
            return res.status(400).json({
                error: 'Email e senha são obrigatórios'
            });
        }

        // Buscar usuário com seus papéis
        const user = await User.findOne({
            where: { email },
            include: [{
                model: Role,
                as: 'userRoles',
                through: { attributes: [] }
            }]
        });

        if (!user) {
            logger.warn('Tentativa de login com email não cadastrado:', { email });
            return res.status(401).json({
                error: 'Credenciais inválidas'
            });
        }

        // Verificar senha
        const isPasswordValid = await user.validatePassword(password);
        if (!isPasswordValid) {
            logger.warn('Tentativa de login com senha incorreta:', { email });
            return res.status(401).json({
                error: 'Credenciais inválidas'
            });
        }

        // Verificar se usuário está ativo
        if (!user.is_active) {
            logger.warn('Tentativa de login com usuário inativo:', { email });
            return res.status(403).json({
                error: 'Usuário inativo. Entre em contato com o administrador.'
            });
        }

        // Gerar token JWT
        const token = jwt.sign(
            { 
                id: user.id,
                email: user.email,
                roles: user.userRoles.map(role => role.name)
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        logger.info('Login bem-sucedido:', { 
            userId: user.id, 
            email: user.email,
            roles: user.userRoles.map(role => role.name)
        });

        // Retornar token e dados do usuário (exceto senha)
        const userWithoutPassword = {
            id: user.id,
            username: user.username,
            email: user.email,
            is_active: user.is_active,
            roles: user.userRoles
        };

        // Definir cookie com o token
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 horas
        });

        res.json({
            token,
            user: userWithoutPassword
        });
    } catch (error) {
        logger.error('Erro no login:', error);
        res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});

// Registro
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, name } = req.body;

        // Validar entrada
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        // Verificar se usuário já existe
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [{ email }, { username }]
            }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Usuário ou email já existe' });
        }

        // Criar usuário
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            name,
            is_active: true,
            email_verified: false
        });

        // Adicionar role padrão
        const userRole = await Role.findOne({ where: { name: 'user' } });
        await user.addRole(userRole);

        res.status(201).json({
            message: 'Usuário criado com sucesso',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                name: user.name
            }
        });

    } catch (error) {
        logger.error('Erro no registro:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Verificação de email
router.post('/verify-email', async (req, res) => {
    try {
        const { email, code } = req.body;
        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        if (user.verification_code !== code) {
            return res.status(400).json({ error: 'Código de verificação inválido' });
        }

        await user.update({
            email_verified: true,
            verification_code: null
        });

        res.json({ success: true });
    } catch (error) {
        logger.error('Erro na verificação de email:', error);
        res.status(500).json({ error: 'Erro ao verificar email' });
    }
});

// Reenviar código de verificação
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await user.update({ verification_code: verificationCode });
        await sendVerificationEmail(email, verificationCode);

        res.json({ success: true });
    } catch (error) {
        logger.error('Erro ao reenviar verificação:', error);
        res.status(500).json({ error: 'Erro ao reenviar verificação' });
    }
});

// Verificar autenticação
router.get('/check', auth, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            include: [{
                model: Role,
                as: 'userRoles',
                include: [{
                    model: Resource,
                    as: 'accessibleResources'
                }]
            }]
        });

        if (!user) {
            return res.json({ isAuthenticated: false });
        }

        // Verificar se é admin ou tem recursos específicos
        const isAdmin = user.email === 'abner.freitas@neosistemas.com.br' || 
                       user.userRoles.some(role => role.name === 'admin');

        // Obter lista de recursos do usuário
        const resources = user.userRoles.reduce((acc, role) => {
            return [...acc, ...role.accessibleResources.map(resource => resource.path)];
        }, []);

        res.json({
            isAuthenticated: true,
            user: {
                ...user.toJSON(),
                isAdmin,
                resources
            }
        });
    } catch (error) {
        logger.error('Erro ao verificar autenticação:', error);
        res.status(500).json({ error: 'Erro ao verificar autenticação' });
    }
});

// Logout
router.post('/logout', auth, (req, res) => {
    try {
        res.clearCookie('auth_token');
        res.json({ message: 'Logout realizado com sucesso' });
    } catch (error) {
        logger.error('Erro ao fazer logout:', error);
        res.status(500).json({ error: 'Erro ao fazer logout' });
    }
});

// Configuração 2FA
router.post('/setup-2fa', auth, async (req, res) => {
    try {
        const secret = generateTwoFactorSecret();
        await User.update(
            { two_factor_secret: secret.base32 },
            { where: { id: req.user.id } }
        );

        res.json({
            secret: secret.base32,
            qrCode: secret.qr
        });
    } catch (error) {
        logger.error('Erro na configuração 2FA:', error);
        res.status(500).json({ error: 'Erro ao configurar 2FA' });
    }
});

// Verificação 2FA
router.post('/verify-2fa', async (req, res) => {
    try {
        const { tempToken, code } = req.body;
        const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);

        if (!decoded.twoFactorPending) {
            return res.status(400).json({ error: 'Token inválido' });
        }

        const user = await User.findByPk(decoded.id);
        if (!user || !verifyTwoFactorToken(user.two_factor_secret, code)) {
            return res.status(401).json({ error: 'Código 2FA inválido' });
        }

        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ success: true, token });
    } catch (error) {
        logger.error('Erro na verificação 2FA:', error);
        res.status(500).json({ error: 'Erro ao verificar 2FA' });
    }
});

// Rota para obter recursos do usuário
router.get('/user-resources', async (req, res) => {
    try {
        // Verificar se há token no header Authorization
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Acesso negado. Autenticação necessária.' });
        }

        const token = authHeader.split(' ')[1];
        
        // Verificar token
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta');
            
            // Buscar usuário no banco de dados
            const user = await User.findByPk(decoded.id, {
                include: [{
                    model: Role,
                    as: 'userRoles',
                    include: [{
                        model: Resource,
                        as: 'accessibleResources'
                    }]
                }]
            });
            
            if (!user) {
                return res.status(401).json({ error: 'Usuário não encontrado.' });
            }
            
            if (!user.is_active) {
                return res.status(403).json({ error: 'Conta desativada. Entre em contato com o administrador.' });
            }
            
            // Verificar se o usuário é admin
            const isAdmin = user.userRoles && user.userRoles.some(role => role.name.toLowerCase() === 'admin');
            
            if (isAdmin) {
                // Se for admin, retornar todos os recursos
                const allResources = await Resource.findAll();
                return res.json(allResources);
            }
            
            // Extrair recursos únicos de todos os papéis do usuário
            const userResources = [];
            const resourceIds = new Set();
            
            user.userRoles.forEach(role => {
                role.accessibleResources.forEach(resource => {
                    if (!resourceIds.has(resource.id)) {
                        resourceIds.add(resource.id);
                        userResources.push(resource);
                    }
                });
            });
            
            res.json(userResources);
        } catch (error) {
            logger.error('Erro ao verificar token:', error);
            return res.status(401).json({ error: 'Token inválido ou expirado.' });
        }
    } catch (error) {
        logger.error('Erro ao obter recursos do usuário:', error);
        return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// Obter configurações do usuário
router.get('/user/settings', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Buscar usuário com suas funções
        const user = await User.findByPk(userId, {
            include: [{
                model: Role,
                as: 'userRoles',
                through: { attributes: [] } // Não incluir tabela de junção
            }]
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        // Extrair os nomes das roles para o token
        const roleNames = user.userRoles.map(role => role.name);

        // Retornar configurações do usuário
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            theme: user.theme || 'light',
            createdAt: user.createdAt
        });
    } catch (error) {
        logger.error('Erro ao buscar configurações do usuário:', error);
        res.status(500).json({ error: 'Erro ao buscar configurações do usuário' });
    }
});

// Atualizar configurações do usuário
router.post('/user/settings', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, email, theme } = req.body;
        
        // Buscar usuário no banco de dados
        const user = await User.findByPk(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        // Atualizar dados do usuário
        await user.update({
            name: name || user.name,
            email: email || user.email,
            theme: theme || user.theme
        });
        
        // Retornar configurações atualizadas
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            theme: user.theme,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        });
    } catch (error) {
        logger.error('Erro ao atualizar configurações do usuário:', error);
        res.status(500).json({ error: 'Erro ao atualizar configurações do usuário' });
    }
});

module.exports = router; 