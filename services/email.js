const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_SECURE === 'true',
            tls: {
                rejectUnauthorized: false,
                enabled: process.env.EMAIL_TLS === 'true'
            },
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            debug: process.env.EMAIL_DEBUG === 'true'
        });
    }

    async sendEmail(to, subject, content) {
        try {
            const mailOptions = {
                from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
                to,
                subject,
                html: content
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email enviado:', info.messageId);
            return true;
        } catch (error) {
            console.error('Erro ao enviar email:', error);
            throw error;
        }
    }

    async sendVerificationEmail(email, userId) {
        try {
            // Buscar o usuário e seu código de verificação
            const { User } = require('../models/postgresql/associations');
            const user = await User.findByPk(userId);
            
            if (!user || !user.verification_code) {
                throw new Error('Código de verificação não disponível para o usuário');
            }
            
            const verificationCode = user.verification_code;
            
            const subject = 'Verificação de Conta - NeoHub';
            const content = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Bem-vindo ao NeoHub!</h2>
                    <p>Obrigado por se registrar. Para verificar sua conta, use o código abaixo:</p>
                    
                    <div style="
                        background-color: #f5f5f5;
                        padding: 15px;
                        text-align: center;
                        font-size: 24px;
                        font-weight: bold;
                        letter-spacing: 5px;
                        margin: 20px 0;
                        border-radius: 5px;
                    ">
                        ${verificationCode}
                    </div>
                    
                    <p>Ou você pode clicar no link abaixo para verificar automaticamente:</p>
                    <p>
                        <a href="${process.env.APP_URL || 'http://localhost:3030'}/api/auth/verify-email?code=${verificationCode}&email=${encodeURIComponent(email)}" style="
                            background-color: #4CAF50;
                            color: white;
                            padding: 10px 20px;
                            text-decoration: none;
                            border-radius: 5px;
                            display: inline-block;
                        ">
                            Verificar Email
                        </a>
                    </p>
                    
                    <p>Este código expira em 24 horas.</p>
                    <p>Se você não se registrou no NeoHub, por favor ignore este email.</p>
                    
                    <hr>
                    <p style="color: #666; font-size: 12px;">
                        Este é um email automático, não responda.
                    </p>
                </div>
            `;
            
            return this.sendEmail(email, subject, content);
        } catch (error) {
            console.error('Erro ao enviar email de verificação:', error);
            throw error;
        }
    }

    async sendPasswordReset(email, resetToken) {
        const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
        const subject = 'Redefinição de Senha';
        const content = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Redefinição de Senha</h2>
                <p>Foi solicitada uma redefinição de senha para sua conta.</p>
                <p>Clique no link abaixo para redefinir sua senha:</p>
                <p>
                    <a href="${resetUrl}" style="
                        background-color: #4CAF50;
                        color: white;
                        padding: 10px 20px;
                        text-decoration: none;
                        border-radius: 5px;
                        display: inline-block;
                    ">
                        Redefinir Senha
                    </a>
                </p>
                <p>Se você não solicitou esta redefinição, ignore este email.</p>
                <p>Este link expira em 1 hora.</p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                    Este é um email automático, não responda.
                </p>
            </div>
        `;

        return this.sendEmail(email, subject, content);
    }

    async sendWelcome(email, username) {
        const subject = 'Bem-vindo ao Sistema!';
        const content = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Bem-vindo, ${username}!</h2>
                <p>Estamos felizes em ter você conosco!</p>
                <p>Seu cadastro foi realizado com sucesso.</p>
                <p>
                    <a href="${process.env.APP_URL}/login" style="
                        background-color: #4CAF50;
                        color: white;
                        padding: 10px 20px;
                        text-decoration: none;
                        border-radius: 5px;
                        display: inline-block;
                    ">
                        Acessar Sistema
                    </a>
                </p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                    Este é um email automático, não responda.
                </p>
            </div>
        `;

        return this.sendEmail(email, subject, content);
    }
}

module.exports = new EmailService(); 