const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const logger = require('../utils/logger');

// Gerar segredo para 2FA
function generateTwoFactorSecret() {
    try {
        const secret = speakeasy.generateSecret({
            name: process.env.TWO_FACTOR_APP_NAME
        });

        return {
            base32: secret.base32,
            qr: QRCode.toDataURL(secret.otpauth_url)
        };
    } catch (error) {
        logger.error('Erro ao gerar segredo 2FA:', error);
        throw new Error('Erro ao gerar configuração 2FA');
    }
}

// Verificar token 2FA
function verifyTwoFactorToken(secret, token) {
    try {
        return speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 1
        });
    } catch (error) {
        logger.error('Erro ao verificar token 2FA:', error);
        return false;
    }
}

module.exports = {
    generateTwoFactorSecret,
    verifyTwoFactorToken
}; 