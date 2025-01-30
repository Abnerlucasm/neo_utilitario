const winston = require('winston');
const path = require('path');

// Configurar formato dos logs
const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return JSON.stringify({
            timestamp,
            level,
            message,
            ...meta
        });
    })
);

// Criar o logger
const logger = winston.createLogger({
    format: logFormat,
    transports: [
        // Log de erros
        new winston.transports.File({ 
            filename: path.join(__dirname, '../logs/error.log'),
            level: 'error'
        }),
        // Log geral
        new winston.transports.File({ 
            filename: path.join(__dirname, '../logs/combined.log')
        }),
        // Log no console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Criar diretório de logs se não existir
const fs = require('fs');
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

module.exports = logger; 