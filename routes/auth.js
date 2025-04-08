'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, Role, Resource } = require('../models/postgresql/associations');
const auth = require('../middlewares/auth');
const { requireAuth } = require('../middlewares/access-control');
const emailService = require('../services/email.service');
const { generateTwoFactorSecret, verifyTwoFactorToken } = require('../services/twoFactor');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const { sequelize } = require('../models/postgresql/associations');

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

        // Verificar conexão com o banco antes de prosseguir
        try {
            await sequelize.authenticate();
            logger.info('Conexão com PostgreSQL OK');
        } catch (dbError) {
            logger.error('Erro na conexão com PostgreSQL:', dbError);
            return res.status(500).json({
                error: 'Falha na conexão com o banco de dados',
                details: dbError.message
            });
        }

        // Verificar se User e Role estão definidos corretamente
        if (!User || !Role) {
            logger.error('Modelos User ou Role não estão definidos corretamente');
            return res.status(500).json({
                error: 'Erro na configuração dos modelos',
                details: 'Os modelos User ou Role não foram inicializados corretamente'
            });
        }

        // Verificar se as associações estão definidas
        if (!User.associations || !User.associations.userRoles) {
            logger.error('Associações do modelo User não estão definidas corretamente');
            
            // Tentar inicializar associações
            require('../models/postgresql/associations').initAssociations();
            logger.info('Tentativa de reinicializar associações realizada');
            
            // Verificar novamente
            if (!User.associations || !User.associations.userRoles) {
                return res.status(500).json({
                    error: 'Erro nas associações dos modelos',
                    details: 'A associação entre User e Role não está definida corretamente'
                });
            }
        }

        // Buscar usuário com seus papéis
        let user;
        try {
            user = await User.findOne({
                where: { email },
                include: [{
                    model: Role,
                    as: 'userRoles',
                    through: { attributes: [] }
                }]
            });
            
            logger.info(`Consulta de usuário realizada. Encontrado: ${!!user}`);
        } catch (queryError) {
            logger.error('Erro ao buscar usuário no banco:', queryError);
            return res.status(500).json({
                error: 'Erro na consulta do banco de dados',
                details: queryError.message
            });
        }

        if (!user) {
            logger.warn('Tentativa de login com email não cadastrado:', { email });
            return res.status(401).json({
                error: 'Credenciais inválidas'
            });
        }

        // Verificar senha
        let isPasswordValid;
        try {
            // Registrar a senha para debug (remova em produção!)
            logger.debug(`Tentando validar senha para o usuário ${email}`, {
                passwordInputLength: password ? password.length : 0,
                hashedPasswordInDB: user.password ? user.password.substring(0, 10) + '...' : 'Não disponível',
                passwordHash: user.password
            });
            
            // Usar diretamente o bcrypt para comparar
            isPasswordValid = await bcrypt.compare(password, user.password);
            
            logger.info(`Validação direta de senha para ${email}: ${isPasswordValid}`);
            
            if (!isPasswordValid) {
                // Tentar método do modelo também para comparação
                const modelValidation = await user.validatePassword(password);
                logger.info(`Validação pelo modelo para ${email}: ${modelValidation}`);
            }
        } catch (passwordError) {
            logger.error('Erro ao validar senha:', passwordError);
            return res.status(500).json({
                error: 'Erro na validação de senha',
                details: passwordError.message
            });
        }
        
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

        // Verificar se o email foi verificado
        if (!user.email_verified) {
            logger.warn('Tentativa de login com email não verificado:', { email });
            return res.status(403).json({
                error: 'Email não verificado',
                need_verification: true,
                email: user.email
            });
        }

        // Gerar token JWT
        const token = jwt.sign(
            { 
                id: user.id,
                email: user.email,
                roles: user.userRoles.map(role => role.name),
                email_verified: user.email_verified
            },
            process.env.JWT_SECRET || 'seu_segredo_jwt_padrao',
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
            email_verified: user.email_verified,
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
        logger.error('Erro no login:', error.message, error.stack);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: error.message
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
        const user = await User.create({
            username,
            email,
            password,
            name,
            is_active: true,
            email_verified: false
        });

        // Adicionar role padrão
        try {
            const userRole = await Role.findOne({ where: { name: 'user' } });
            
            if (userRole) {
                // Usar o modelo de associação para criar a relação, sem especificar um ID
                await sequelize.query(
                    'INSERT INTO user_roles(user_id, role_id, created_at, updated_at) VALUES(?, ?, NOW(), NOW())',
                    {
                        replacements: [user.id, userRole.id],
                        type: sequelize.QueryTypes.INSERT
                    }
                );
                
                logger.info(`Role 'user' adicionada para o usuário ${user.id}`);
            } else {
                logger.warn('Role padrão "user" não encontrada');
            }
        } catch (roleError) {
            logger.error('Erro ao adicionar role ao usuário:', roleError);
            // Não falhar o registro se a adição da role falhar
        }
        
        // Verificar se há suporte para envio de email
        try {
            // Se houver um serviço de email configurado, enviar código de verificação
            if (process.env.EMAIL_SECRET && process.env.EMAIL_FROM) {
                // Gerar um código de verificação aleatório
                const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                
                // Atualizar o usuário com o código de verificação
                await user.update({ verification_code: verificationCode });
                
                // Enviar o email com o código
                await emailService.sendVerificationCode(email, verificationCode);
                logger.info('Email de verificação enviado para:', email);
            } else {
                // Se não houver, marcar o email como verificado automaticamente
                logger.warn('EMAIL_SECRET ou EMAIL_FROM não configurado, ignorando verificação de email');
                await user.update({ email_verified: true });
            }
        } catch (emailError) {
            logger.error('Erro ao processar email de verificação:', emailError);
            // Não falhar o registro se o email falhar
            // Marcar o email como verificado para permitir login mesmo sem verificação
            await user.update({ email_verified: true });
        }

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

// Verificação de email via API (POST)
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

// Verificação de email via link (GET)
router.get('/verify-email', async (req, res) => {
    try {
        const { email, code } = req.query;
        
        if (!email || !code) {
            return res.status(400).json({ error: 'Email e código de verificação são necessários' });
        }
        
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

        // Redirecionar para a página de login com uma mensagem de sucesso
        res.redirect('/pages/login.html?verified=true');
    } catch (error) {
        logger.error('Erro na verificação de email via link:', error);
        res.redirect('/pages/login.html?error=verification_failed');
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
        await emailService.sendVerificationCode(email, verificationCode);

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

// Rota de diagnóstico para verificar sistema de login
router.post('/login-diagnostico', async (req, res) => {
    try {
        const { email, password } = req.body;

        logger.info('Diagnóstico de login:', { email });

        if (!email || !password) {
            return res.json({
                success: false,
                phase: 'validation',
                error: 'Email e senha são obrigatórios'
            });
        }

        // Testar conexão com PostgreSQL
        try {
            await sequelize.authenticate();
            logger.info('Conexão com PostgreSQL OK');
        } catch (dbError) {
            logger.error('Erro na conexão com PostgreSQL:', dbError);
            return res.json({
                success: false,
                phase: 'database_connection',
                error: 'Falha na conexão com o banco de dados',
                details: dbError.message
            });
        }

        // Buscar usuário
        let user;
        try {
            user = await User.findOne({
                where: { email },
                include: [{
                    model: Role,
                    as: 'userRoles',
                    through: { attributes: [] }
                }]
            });
            
            if (!user) {
                return res.json({
                    success: false,
                    phase: 'user_lookup',
                    error: 'Usuário não encontrado'
                });
            }
            
            logger.info('Usuário encontrado:', { 
                id: user.id, 
                roles: user.userRoles.map(r => r.name).join(', ')
            });
        } catch (userError) {
            logger.error('Erro ao buscar usuário:', userError);
            return res.json({
                success: false,
                phase: 'user_lookup',
                error: 'Falha ao buscar usuário',
                details: userError.message
            });
        }

        // Verificar senha
        try {
            // Testar se o bcrypt está instalado corretamente
            const bcryptTest = require('bcryptjs');
            if (typeof bcryptTest.compare !== 'function') {
                throw new Error('bcrypt.compare não é uma função');
            }
            
            // Verificar formato da senha
            const passwordDetails = {
                passwordExists: !!user.password,
                passwordLength: user.password ? user.password.length : 0,
                isPasswordHashed: user.password && user.password.startsWith('$2')
            };
            
            logger.info('Detalhes da senha armazenada:', passwordDetails);
            
            // Tentar validar a senha
            const isPasswordValid = await user.validatePassword(password);
            
            if (!isPasswordValid) {
                return res.json({
                    success: false,
                    phase: 'password_validation',
                    error: 'Senha incorreta',
                    passwordDetails
                });
            }
            
            logger.info('Senha validada com sucesso');
        } catch (passwordError) {
            logger.error('Erro ao validar senha:', passwordError);
            return res.json({
                success: false,
                phase: 'password_validation',
                error: 'Falha na validação de senha',
                details: passwordError.message
            });
        }

        // Se chegou até aqui, o login seria bem-sucedido
        return res.json({
            success: true,
            message: 'Diagnóstico completo. Login seria bem-sucedido.',
            userDetails: {
                id: user.id,
                email: user.email,
                isActive: user.is_active,
                roles: user.userRoles.map(r => r.name)
            }
        });
    } catch (error) {
        logger.error('Erro no diagnóstico de login:', error);
        res.json({
            success: false,
            phase: 'unknown',
            error: 'Erro não tratado no diagnóstico',
            details: error.message,
            stack: error.stack
        });
    }
});

// Rota de teste para diagnóstico de senha
router.post('/debug-password', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }
        
        const user = await User.findOne({ where: { email } });
        
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        // Tentar diferentes abordagens para validar a senha
        const debug = {
            userFound: true,
            passwordInDB: user.password ? user.password.substring(0, 10) + '...' : 'Não disponível',
            bcryptCompare: await bcrypt.compare(password, user.password),
            modelValidate: await user.validatePassword(password)
        };
        
        return res.json({
            success: debug.bcryptCompare && debug.modelValidate,
            debug
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Erro no diagnóstico',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Rota de emergência para redefinir senha (desativar em produção)
router.post('/reset-password-emergency', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        
        if (!email || !newPassword) {
            return res.status(400).json({ error: 'Email e nova senha são obrigatórios' });
        }
        
        const user = await User.findOne({ where: { email } });
        
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        // Gerar hash da nova senha
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Atualizar a senha do usuário
        await user.update({ 
            password: hashedPassword,
            email_verified: true // Garantir que o email está verificado
        });
        
        return res.json({
            success: true,
            message: 'Senha redefinida com sucesso'
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Erro ao redefinir senha',
            message: error.message
        });
    }
});

// Solicitar código de recuperação de senha
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email é obrigatório' });
        }
        
        // Verificar se o usuário existe
        const user = await User.findOne({ where: { email } });
        
        if (!user) {
            // Por segurança, não informamos se o email existe ou não
            return res.status(200).json({
                success: true,
                message: 'Se o email estiver cadastrado, um código de recuperação foi enviado.'
            });
        }
        
        // Gerar código de recuperação de 6 caracteres
        const resetCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Gerar data de expiração (1 hora a partir de agora)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        
        // Atualizar usuário com o código e data de expiração
        await user.update({
            reset_token: resetCode,
            reset_token_expires: expiresAt
        });
        
        // Enviar email com o código
        try {
            await emailService.sendPasswordResetCode(email, resetCode);
            logger.info('Email de recuperação enviado para:', email);
        } catch (emailError) {
            logger.error('Erro ao enviar email de recuperação:', emailError);
            
            // Mesmo com erro no envio, retornamos sucesso por segurança
            return res.status(200).json({
                success: true,
                message: 'Se o email estiver cadastrado, um código de recuperação foi enviado.'
            });
        }
        
        // Responder com sucesso
        res.status(200).json({
            success: true,
            message: 'Código de recuperação enviado com sucesso.'
        });
        
    } catch (error) {
        logger.error('Erro na solicitação de recuperação de senha:', error);
        res.status(500).json({ error: 'Erro ao processar solicitação de recuperação' });
    }
});

// Verificar código de recuperação
router.post('/verify-reset-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        
        if (!email || !code) {
            return res.status(400).json({ error: 'Email e código são obrigatórios' });
        }
        
        const user = await User.findOne({ 
            where: { 
                email,
                reset_token: code,
                reset_token_expires: { [Op.gt]: new Date() } // Verifica se o token não expirou
            }
        });
        
        if (!user) {
            return res.status(400).json({ error: 'Código inválido ou expirado' });
        }
        
        // Gerar token JWT para reset de senha
        const resetToken = jwt.sign(
            { 
                id: user.id,
                email: user.email,
                purpose: 'password_reset'
            },
            process.env.JWT_SECRET,
            { expiresIn: '15m' } // Token válido por 15 minutos
        );
        
        res.json({
            success: true,
            token: resetToken
        });
        
    } catch (error) {
        logger.error('Erro na verificação do código de recuperação:', error);
        res.status(500).json({ error: 'Erro ao verificar código' });
    }
});

// Redefinir senha
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        
        if (!token || !password) {
            return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
        }
        
        // Verificar token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Verificar se o token é para reset de senha
            if (decoded.purpose !== 'password_reset') {
                throw new Error('Token inválido');
            }
        } catch (tokenError) {
            logger.error('Token de reset de senha inválido:', tokenError);
            return res.status(401).json({ error: 'Token inválido ou expirado' });
        }
        
        // Buscar usuário
        const user = await User.findByPk(decoded.id);
        
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        // Atualizar senha
        await user.update({ 
            password, // O hook do modelo cuidará da criptografia
            reset_token: null,
            reset_token_expires: null
        });
        
        // Responder com sucesso
        res.json({
            success: true,
            message: 'Senha redefinida com sucesso'
        });
        
    } catch (error) {
        logger.error('Erro na redefinição de senha:', error);
        res.status(500).json({ error: 'Erro ao redefinir senha' });
    }
});

module.exports = router; 