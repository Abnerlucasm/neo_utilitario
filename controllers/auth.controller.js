'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Role, Permission } = require('../models');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class AuthController {
    async login(req, res) {
        try {
            const { email, password } = req.body;

            // Buscar usuário com roles e permissões
            const user = await User.findOne({
                where: { email },
                include: [{
                    model: Role,
                    as: 'userRoles'
                }]
            });

            if (!user) {
                logger.warn('Tentativa de login com email não encontrado:', email);
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }

            // Verificar se o email foi verificado
            if (!user.email_verified) {
                return res.status(403).json({ 
                    error: 'Email não verificado',
                    redirect: '/verify-email'
                });
            }

            // Verificar senha
            const isValidPassword = await user.validatePassword(password);
            if (!isValidPassword) {
                logger.warn('Tentativa de login com senha inválida para:', email);
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }

            // Gerar token JWT
            const roles = user.userRoles ? user.userRoles.map(role => role.name) : [];
            const permissions = user.userRoles ? user.userRoles.flatMap(role => 
                role.permissions ? role.permissions.map(p => p.name) : []
            ) : [];

            const token = jwt.sign(
                { 
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    roles: roles,
                    permissions: permissions
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            // Atualizar último login
            await user.update({
                last_login: new Date()
            });

            // Definir cookie de autenticação
            res.cookie('auth_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 24 * 60 * 60 * 1000 // 24 horas
            });

            logger.info('Login bem-sucedido:', { userId: user.id, email });

            // Responder imediatamente após definir o cookie
            return res.status(200).json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                }
            });

        } catch (error) {
            logger.error('Erro no login:', error);
            return res.status(500).json({ 
                error: 'Erro interno do servidor',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    async register(req, res) {
        try {
            const { username, email, password } = req.body;

            // Validar campos obrigatórios
            if (!username || !email || !password) {
                return res.status(400).json({
                    error: 'Dados inválidos',
                    details: 'Todos os campos são obrigatórios'
                });
            }

            // Verificar se usuário já existe
            const existingUser = await User.findOne({
                where: {
                    [Op.or]: [
                        { email },
                        { username }
                    ]
                }
            });

            if (existingUser) {
                return res.status(400).json({
                    error: 'Usuário já existe',
                    details: 'Email ou nome de usuário já está em uso'
                });
            }

            // Gerar código de verificação
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Gerar token de verificação
            const verificationToken = jwt.sign(
                { email, code: verificationCode },
                process.env.EMAIL_SECRET,
                { expiresIn: '1h' }
            );

            // Criar novo usuário
            const user = await User.create({
                username,
                email,
                password,  // O hash é feito automaticamente pelo hook no modelo
                is_active: true,
                email_verified: false,
                verification_token: verificationToken
            });

            logger.info(`Novo usuário registrado: ${email}`);

            // Enviar email com código de verificação
            try {
                await emailService.sendVerificationCode(email, verificationCode);
                logger.info('Email de verificação enviado:', { email });
            } catch (emailError) {
                logger.error('Erro ao enviar email:', emailError);
                // Não falhar o registro se o email falhar
            }

            // Definir cookie de verificação
            res.cookie('verification_token', verificationToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 1000 // 1 hora
            });

            res.status(201).json({
                message: 'Usuário registrado com sucesso',
                userId: user.id
            });

        } catch (error) {
            logger.error('Erro no registro:', error);
            res.status(500).json({
                error: 'Erro interno do servidor',
                details: error.message
            });
        }
    }

    async verifyEmail(req, res) {
        try {
            const { code } = req.body;
            const token = req.cookies.verification_token;

            if (!token) {
                return res.status(400).json({ error: 'Token de verificação não encontrado' });
            }

            try {
                const decoded = jwt.verify(token, process.env.EMAIL_SECRET);
                
                if (decoded.code !== code) {
                    return res.status(400).json({ error: 'Código inválido' });
                }

                // Atualizar usuário
                await User.update(
                    { 
                        email_verified: true,
                        verification_token: null
                    },
                    { where: { email: decoded.email } }
                );

                // Limpar cookie de verificação
                res.clearCookie('verification_token');

                return res.json({
                    success: true,
                    message: 'Email verificado com sucesso'
                });
            } catch (error) {
                return res.status(400).json({ error: 'Token inválido ou expirado' });
            }
        } catch (error) {
            logger.error('Erro na verificação de email:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    async logout(req, res) {
        try {
            // Limpar cookie de autenticação
            res.clearCookie('auth_token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/'
            });
            
            return res.json({
                success: true,
                message: 'Logout realizado com sucesso'
            });
        } catch (error) {
            logger.error('Erro no logout:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    async resendVerification(req, res) {
        try {
            // Pegar o token do cookie
            const token = req.cookies.verification_token;
            if (!token) {
                return res.status(400).json({ error: 'Token de verificação não encontrado' });
            }

            // Decodificar o token
            const decoded = jwt.verify(token, process.env.EMAIL_SECRET);
            if (!decoded.email) {
                return res.status(400).json({ error: 'Token inválido' });
            }

            // Gerar novo código
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Criar novo token
            const newToken = jwt.sign(
                { email: decoded.email, code: verificationCode },
                process.env.EMAIL_SECRET,
                { expiresIn: '1h' }
            );

            // Atualizar o token no usuário
            await User.update(
                { verification_token: newToken },
                { where: { email: decoded.email } }
            );

            // Enviar novo código por email
            await emailService.sendVerificationCode(decoded.email, verificationCode);

            // Atualizar o cookie
            res.cookie('verification_token', newToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 1000 // 1 hora
            });

            return res.json({
                success: true,
                message: 'Novo código enviado com sucesso'
            });
        } catch (error) {
            console.error('Erro ao reenviar código:', error);
            return res.status(500).json({ error: 'Erro ao reenviar código de verificação' });
        }
    }

    async checkAuth(req, res) {
        try {
            if (req.isAuthenticated()) {
                return res.json({
                    authenticated: true,
                    user: {
                        id: req.user.id,
                        username: req.user.username,
                        email: req.user.email
                    }
                });
            }
            return res.json({ authenticated: false });
        } catch (error) {
            logger.error('Erro ao verificar autenticação:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    async requestPasswordReset(req, res) {
        try {
            const { email } = req.body;
            
            if (!email) {
                return res.status(400).json({ error: 'Email é obrigatório' });
            }
            
            // Verificar se o usuário existe
            const user = await User.findOne({ where: { email } });
            
            if (!user) {
                // Por segurança, não informamos que o email não existe
                return res.status(200).json({ 
                    message: 'Se o email estiver cadastrado, um código de recuperação será enviado.' 
                });
            }
            
            // Gerar código de recuperação de 6 dígitos
            const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Gerar token com validade de 15 minutos
            const resetToken = jwt.sign(
                { userId: user.id, code: resetCode },
                process.env.JWT_SECRET,
                { expiresIn: '15m' }
            );
            
            // Salvar o token no usuário
            await user.update({ reset_token: resetToken });
            
            // Enviar email com o código
            await emailService.sendPasswordResetCode(email, resetCode);
            
            return res.status(200).json({ 
                message: 'Se o email estiver cadastrado, um código de recuperação será enviado.' 
            });
            
        } catch (error) {
            logger.error('Erro ao solicitar recuperação de senha:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
    
    async resetPassword(req, res) {
        try {
            const { email, code, newPassword } = req.body;
            
            if (!email || !code || !newPassword) {
                return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
            }
            
            // Buscar usuário pelo email
            const user = await User.findOne({ where: { email } });
            
            if (!user || !user.reset_token) {
                return res.status(400).json({ error: 'Código inválido ou expirado' });
            }
            
            try {
                // Verificar o token e o código
                const decoded = jwt.verify(user.reset_token, process.env.JWT_SECRET);
                
                if (decoded.code !== code) {
                    return res.status(400).json({ error: 'Código inválido' });
                }
                
                // Atualizar a senha e limpar o token
                user.password = newPassword; // O hash será feito pelo hook do modelo
                user.reset_token = null;
                await user.save();
                
                logger.info(`Senha redefinida com sucesso para o usuário: ${email}`);
                
                return res.status(200).json({ 
                    success: true, 
                    message: 'Senha redefinida com sucesso' 
                });
                
            } catch (error) {
                return res.status(400).json({ error: 'Código inválido ou expirado' });
            }
            
        } catch (error) {
            logger.error('Erro ao redefinir senha:', error);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // ... outros métodos do controlador
}

module.exports = new AuthController(); 