'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('./utils/logger');
const initializeDatabase = require('./config/init-db');

async function startServer() {
    try {
        // Inicializar banco de dados
        await initializeDatabase();

        const app = express();
        
        // Middlewares básicos
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(cookieParser());

        // Servir arquivos estáticos
        app.use(express.static('public'));
        
        // Configurar rotas da API
        app.use('/api', require('./routes/api'));

        // Rota para a página de aprendizagem
        app.get('/learn', (req, res) => {
            res.sendFile(path.join(__dirname, 'public/learn.html'));
        });

        // Rota para outras páginas HTML
        app.get('/*.html', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', req.path));
        });

        // Página 404 personalizada
        app.use((req, res) => {
            res.status(404).sendFile(path.join(__dirname, 'public/404.html'));
        });

        // Iniciar servidor
        const PORT = process.env.PORT || 3030;
        app.listen(PORT, () => {
            logger.info(`Servidor iniciado na porta ${PORT}`);
        });

    } catch (error) {
        logger.error('Erro fatal ao iniciar aplicação:', error);
        process.exit(1);
    }
}

startServer();

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
    logger.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
}); 