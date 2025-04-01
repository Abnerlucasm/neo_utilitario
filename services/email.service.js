'use strict';

const nodemailer = require('nodemailer');
const config = require('../config/email.config');
const logger = require('../utils/logger');

class EmailService {
    constructor() {
        // Log das configurações (ocultando senha)
        logger.info('Inicializando serviço de email com configurações:', {
            host: config.host,
            port: config.port,
            secure: config.secure,
            tls: !!config.tls,
            auth: { user: config.auth.user, pass: '***' }
        });

        this.transporter = nodemailer.createTransport(config);
        
        // Verificar conexão na inicialização
        this.verifyConnection().catch(error => {
            logger.error('Erro na verificação inicial do email:', error);
        });
    }

    async verifyConnection() {
        try {
            logger.info('Verificando conexão com servidor de email...');
            const verification = await this.transporter.verify();
            logger.info('Conexão com servidor de email:', verification ? 'OK' : 'Falhou');
            return verification;
        } catch (error) {
            logger.error('Erro ao verificar conexão com servidor de email:', error);
            throw error; // Propagar erro para melhor diagnóstico
        }
    }

    async sendVerificationCode(to, code) {
        try {
            const info = await this.transporter.sendMail({
                from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
                to: to,
                subject: 'Verificação de Email - NeoHub',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Bem-vindo ao NeoHub!</h2>
                        <p>Para verificar seu email, use o código abaixo:</p>
                        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
                            <strong>${code}</strong>
                        </div>
                        <p>Este código expira em 1 hora.</p>
                        <p>Se você não solicitou este código, ignore este email.</p>
                    </div>
                `
            });

            logger.info('Email enviado:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            logger.error('Erro ao enviar email:', error);
            return { success: false, error: error.message };
        }
    }

    async send2FACode(email, code) {
        const mailOptions = {
            from: {
                name: process.env.EMAIL_FROM_NAME || 'CorpWeb',
                address: process.env.EMAIL_FROM
            },
            to: email,
            subject: 'Código de Autenticação em Dois Fatores',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #333; text-align: center;">Código de Autenticação</h1>
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
                        <p style="font-size: 16px;">Seu código de autenticação é:</p>
                        <p style="font-size: 24px; font-weight: bold; text-align: center; color: #485fc7;">
                            ${code}
                        </p>
                        <p style="color: #666; font-size: 14px;">
                            Este código expira em 5 minutos.<br>
                            Se você não tentou fazer login, alguém pode estar tentando acessar sua conta.
                        </p>
                    </div>
                </div>
            `
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            logger.info('Email 2FA enviado:', info.messageId);
            return true;
        } catch (error) {
            logger.error('Erro ao enviar email 2FA:', error);
            return false;
        }
    }
}

module.exports = new EmailService(); 