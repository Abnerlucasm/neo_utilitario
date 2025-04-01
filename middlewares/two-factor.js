'use strict';

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const emailService = require('../services/email.service');

async function require2FA(req, res, next) {
    try {
        const user = await User.findOne({ where: { email: req.body.email } });
        
        if (user && user.two_factor_enabled) {
            // Gerar código de 6 dígitos
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Criar token temporário
            const tempToken = jwt.sign(
                { userId: user.id, code },
                process.env.EMAIL_SECRET,
                { expiresIn: '5m' }
            );

            // Enviar código por email
            await emailService.send2FACode(user.email, code);

            return res.json({
                needsTwoFactor: true,
                tempToken
            });
        }
        
        next();
    } catch (error) {
        console.error('Erro no 2FA:', error);
        res.status(500).json({ error: 'Erro ao processar 2FA' });
    }
}

module.exports = require2FA; 