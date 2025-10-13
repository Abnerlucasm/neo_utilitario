/**
 * Servidor Otimizado para Produção
 * Inclui middleware de segurança, compressão e otimizações
 */

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware de segurança para produção
if (NODE_ENV === 'production') {
    // Helmet para headers de segurança
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    }));

    // Compressão gzip
    app.use(compression({
        level: 6,
        threshold: 1024,
        filter: (req, res) => {
            if (req.headers['x-no-compression']) {
                return false;
            }
            return compression.filter(req, res);
        }
    }));
}

// CORS
app.use(cors({
    origin: NODE_ENV === 'production' ? ['https://seudominio.com'] : true,
    credentials: true
}));

// Servir arquivos estáticos
const staticPath = NODE_ENV === 'production' ? 'dist' : 'public';
app.use(express.static(staticPath, {
    maxAge: NODE_ENV === 'production' ? '1y' : '0',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        // Cache headers para diferentes tipos de arquivo
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        } else if (path.endsWith('.js') || path.endsWith('.css')) {
            res.setHeader('Cache-Control', NODE_ENV === 'production' ? 'public, max-age=31536000' : 'no-cache');
        } else if (path.match(/\.(jpg|jpeg|png|gif|ico|svg)$/)) {
            res.setHeader('Cache-Control', NODE_ENV === 'production' ? 'public, max-age=31536000' : 'no-cache');
        }
    }
}));

// API routes (se houver)
app.use('/api', require('./routes/api'));

// SPA fallback - servir index.html para todas as rotas não encontradas
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, staticPath, 'pages', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Erro do servidor:', err);
    
    if (NODE_ENV === 'production') {
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(500).json({ 
            error: err.message,
            stack: err.stack,
            timestamp: new Date().toISOString()
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Página não encontrada',
        path: req.path,
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM recebido, encerrando servidor graciosamente...');
    server.close(() => {
        console.log('Servidor encerrado');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT recebido, encerrando servidor graciosamente...');
    server.close(() => {
        console.log('Servidor encerrado');
        process.exit(0);
    });
});

const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em modo ${NODE_ENV}`);
    console.log(`📡 Porta: ${PORT}`);
    console.log(`📁 Servindo arquivos de: ${staticPath}`);
    console.log(`🔒 Segurança: ${NODE_ENV === 'production' ? 'Ativada' : 'Desativada'}`);
});

module.exports = app;
