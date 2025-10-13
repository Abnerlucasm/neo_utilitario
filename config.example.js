/**
 * Arquivo de Configuração de Exemplo
 * Copie para config.js e ajuste as configurações
 */

module.exports = {
    // Configurações de Ambiente
    NODE_ENV: process.env.NODE_ENV || 'production',
    PORT: process.env.PORT || 3000,

    // Configurações de Banco de Dados
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        name: process.env.DB_NAME || 'neohub',
        user: process.env.DB_USER || 'neohub_user',
        password: process.env.DB_PASSWORD || 'your_secure_password'
    },

    // Configurações de Segurança
    security: {
        jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
        sessionSecret: process.env.SESSION_SECRET || 'your_session_secret_here',
        bcryptRounds: 12
    },

    // Configurações de Email
    email: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        user: process.env.SMTP_USER || 'your_email@gmail.com',
        pass: process.env.SMTP_PASS || 'your_app_password'
    },

    // Configurações de Log
    logging: {
        level: process.env.LOG_LEVEL || 'error',
        file: process.env.LOG_FILE || './logs/app.log',
        maxSize: '10m',
        maxFiles: 5
    },

    // Configurações de Cache
    cache: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || null,
        ttl: 3600 // 1 hora
    },

    // Configurações de Upload
    upload: {
        maxSize: process.env.UPLOAD_MAX_SIZE || 10485760, // 10MB
        path: process.env.UPLOAD_PATH || './uploads',
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
    },

    // Configurações de CORS
    cors: {
        origin: process.env.CORS_ORIGIN || 'https://seudominio.com',
        credentials: true
    },

    // Configurações de Rate Limiting
    rateLimit: {
        windowMs: process.env.RATE_LIMIT_WINDOW || 900000, // 15 minutos
        max: process.env.RATE_LIMIT_MAX || 100 // requests por window
    },

    // Configurações de PWA
    pwa: {
        enabled: true,
        cacheStrategy: 'cacheFirst',
        offlinePage: '/offline.html'
    }
};
