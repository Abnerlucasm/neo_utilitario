const { createLogger, format, transports } = require('winston');
const path = require('path');

const logger = createLogger({
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        // Console para desenvolvimento
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.simple()
            )
        }),
        // Arquivo para logs gerais
        new transports.File({ 
            filename: path.join(__dirname, '../logs/app.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // Arquivo separado para erros
        new transports.File({ 
            filename: path.join(__dirname, '../logs/error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
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