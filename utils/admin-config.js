/**
 * Configurações do Admin Padrão
 * Centraliza as configurações do admin para facilitar manutenção
 */

const logger = require('./logger');

// Função para obter configurações do admin padrão
function getDefaultAdminConfig() {
    const config = {
        email: process.env.ADMIN_EMAIL || 'admin@neosistemas.com.br',
        username: process.env.ADMIN_USERNAME || 'admin',
        name: process.env.ADMIN_NAME || 'Administrador',
        password: process.env.ADMIN_PASSWORD || 'admin@123',
        isAdmin: true,
        emailVerified: true,
        isActive: true
    };

    logger.info('Configurações do admin padrão carregadas:', {
        email: config.email,
        username: config.username,
        name: config.name,
        // Não logar a senha por segurança
        hasPassword: !!config.password
    });

    return config;
}

// Função para validar se as configurações do admin estão completas
function validateAdminConfig() {
    const config = getDefaultAdminConfig();
    const requiredFields = ['email', 'username', 'name', 'password'];
    const missingFields = requiredFields.filter(field => !config[field]);

    if (missingFields.length > 0) {
        logger.warn('Configurações do admin incompletas:', {
            missingFields,
            currentConfig: {
                email: config.email,
                username: config.username,
                name: config.name,
                hasPassword: !!config.password
            }
        });
        return false;
    }

    return true;
}

// Função para obter apenas o email do admin (usado em verificações)
function getAdminEmail() {
    return process.env.ADMIN_EMAIL || 'admin@neosistemas.com.br';
}

module.exports = {
    getDefaultAdminConfig,
    validateAdminConfig,
    getAdminEmail
}; 