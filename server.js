const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { createLogger, format, transports } = require('winston');
const { promisify } = require('util');
const { exec } = require('child_process');
const { NodeSSH } = require('node-ssh');
const xml2js = require('xml2js');
const fsPromises = require('fs').promises;
const logger = require('./utils/logger');
const { sequelize, initDatabase } = require('./models/postgresql');
const { ensureAdmin } = require('./middlewares/ensure-admin');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const cookieParser = require('cookie-parser');
const { User, Role, Permission, Session, Glassfish } = require('./models/postgresql/associations');
const { requireAuth, requireAdmin } = require('./middlewares/access-control');
const { Pool } = require('pg');
const configurePassport = require('./config/passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const userRouter = require('./routes/user');
const cors = require('cors');
const initServer = require('./scripts/init-server');

// Importar routers
const authRouter = require('./routes/auth');
const glassfishRouter = require('./routes/glassfish');
const suggestionsRouter = require('./routes/suggestions');
const kanbanRouter = require('./routes/kanban');
const contentRouter = require('./routes/content.js');
const componentsRouter = require('./routes/components');
const progressRouter = require('./routes/progress');
const learningRouter = require('./routes/learning');
const rolesRouter = require('./routes/roles');
const menuRouter = require('./routes/menus');

// Importar controllers
const {
    timerController,
    archiveController,
    statusController,
    attachmentsController
} = require('./controllers/kanban');

// Importar rotas de administração
const adminRouter = require('./routes/admin');

// Script de seed de menus foi removido - menus são criados automaticamente

// Importar Sequelize Op
const { Op } = require('sequelize');

// Middlewares básicos
const app = express();
const ssh = new NodeSSH();

// Utilitários de leitura e escrita de arquivos
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

// Caminhos dos arquivos
const CONFIG_PATH = path.join(__dirname, 'config.json');

// Middlewares básicos
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Servir arquivos estáticos ANTES do middleware de autenticação
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use('/modules', express.static(path.join(__dirname, 'public/modules')));
app.use('/styles', express.static(path.join(__dirname, 'public/styles')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// Rota de debug para recursos (temporária) - ANTES do middleware de autenticação
app.get('/api/resources/debug', async (req, res) => {
    try {
        const { Resource } = require('./models/postgresql/associations');
        logger.info('Testando API de recursos (debug)...');
        
        const resources = await Resource.findAll({
            attributes: ['id', 'name', 'path', 'type', 'is_active'],
            limit: 5
        });

        logger.info(`Recursos encontrados: ${resources.length}`);
        
        return res.json({ 
            success: true, 
            data: resources,
            count: resources.length
        });
    } catch (error) {
        logger.error('Erro ao buscar recursos (debug):', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Erro ao buscar recursos',
            error: error.message,
            stack: error.stack
        });
    }
});

// Middleware de autenticação
const authMiddleware = async (req, res, next) => {
    // Rotas públicas que não precisam de autenticação
    const publicPaths = [
        '/pages/login.html',
        '/pages/register.html',
        '/pages/forgot-password.html',
        '/pages/verify-email.html',
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/verify-email',
        '/api/auth/resend-verification',
        '/api/auth/reset-password',
        '/api/auth/request-reset',
        '/api/resources/debug',
        '/styles/',
        '/js/',
        '/assets/',
        '/components/',
        '/favicon.ico',
        '/modules/learning/templates/',
        '/modules/learning/js/auth-debug.js'
    ];

    // Verificar se é uma rota pública
    const isPublicPath = publicPaths.some(path => req.path.startsWith(path));
    if (isPublicPath) {
        logger.debug(`Acesso a rota pública: ${req.path}`);
        return next();
    }

    try {
        // Extrair token do cookie ou do header Authorization
        let token = req.cookies.auth_token;
        
        if (!token && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            // Tratar tanto 'Bearer TOKEN' quanto apenas 'TOKEN'
            token = authHeader.startsWith('Bearer ') 
                ? authHeader.substring(7) 
                : authHeader;
            
            logger.debug(`Token extraído do header Authorization: ${authHeader.substring(0, 15)}...`);
        }

        if (!token) {
            logger.debug('Token não fornecido', {
                path: req.path,
                method: req.method,
                headers: Object.keys(req.headers),
                cookies: Object.keys(req.cookies || {})
            });
            throw new Error('Token não fornecido');
        }

        // Verificar e decodificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        logger.debug(`Token verificado para usuário ID: ${decoded.id}`);
        
        // Buscar usuário
        const user = await User.findByPk(decoded.id, {
            include: [{
                model: Role,
                as: 'userRoles'
            }]
        });

        if (!user) {
            logger.warn('Usuário não encontrado', {
                tokenUserId: decoded.id,
                path: req.path
            });
            throw new Error('Usuário não encontrado');
        }

        // Adicionar usuário ao request
        req.user = user;
        
        // Adicionar uma flag indicando se o usuário é admin
        req.isAdmin = user.userRoles && 
                     user.userRoles.some(role => role.name.toLowerCase() === 'admin');
        
        logger.debug(`Autenticação bem-sucedida para usuário ${user.username} (ID: ${user.id})`);
        next();
    } catch (error) {
        logger.error('Erro na autenticação:', {
            path: req.path,
            error: error.message,
            stack: error.stack
        });
        
        // Limpar cookie inválido
        res.clearCookie('auth_token');
        
        // Para requisições AJAX ou API, retornar JSON
        if (req.xhr || req.path.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({ 
                error: 'Token inválido ou expirado',
                message: error.message
            });
        }

        // Para páginas administrativas, redirecionar para página de redirecionamento
        if (req.path.startsWith('/admin/')) {
            return res.redirect('/modules/learning/templates/admin-redirect.html');
        }

        // Para outras páginas, redirecionar para login
        res.redirect('/pages/login.html');
    }
};

// Rotas públicas da API
app.use('/api/auth', authRouter);

// Aplicar middleware de autenticação para rotas protegidas
app.use('/api/user', authMiddleware, userRouter);
app.use('/api/learning', authMiddleware, learningRouter);
app.use('/api/glassfish', authMiddleware, glassfishRouter);
app.use('/api/suggestions', authMiddleware, suggestionsRouter);
app.use('/api/kanban', authMiddleware, kanbanRouter);
app.use('/api/content', authMiddleware, contentRouter);
app.use('/api/components', authMiddleware, componentsRouter);
app.use('/api/progress', authMiddleware, progressRouter);

// Configurar rota diagnóstica direta (para verificação)
app.get('/api/test', (req, res) => {
    res.json({ status: 'ok', message: 'API funcionando!' });
});

// Registrar rotas da API
console.log('Carregando rotas principais do arquivo routes/index.js');
const routes = require('./routes');
app.use('/', routes);

// Comentando essas rotas pois já estão registradas pelo arquivo routes/index.js
// app.use('/api/menus', menuRouter);

// Adicionar redirecionamentos específicos para módulos de aprendizagem admin
app.get('/admin/learning/modules', authMiddleware, (req, res) => {
    // Verificar se o usuário é admin
    if (!req.isAdmin) {
        return res.redirect('/pages/login.html');
    }
    // Redirecionar para o template correto
    res.redirect('/modules/learning/templates/modules.html');
});

// Redirecionamento para página de aprendizado
app.get('/learn', authMiddleware, (req, res) => {
    res.redirect('/pages/learn.html');
});

// Redirecionamento para módulos de aprendizado específicos
app.get('/learn/:moduleId', authMiddleware, (req, res) => {
    const { moduleId } = req.params;
    res.redirect(`/modules/learning/templates/module-view.html?id=${moduleId}`);
});

// Rota catch-all para SPA
app.get('*', (req, res) => {
    // Verificar se é uma rota de API
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({ error: 'API não encontrada' });
    }
    
    // Servir o arquivo index.html para todas as outras rotas
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Tratamento de erros global
app.use((err, req, res, next) => {
    logger.error('Erro global:', err.stack);
    res.status(500).json({ 
        error: 'Erro interno do servidor', 
        message: err.message,
        path: req.originalUrl
    });
});

// No início do servidor, inicializar o banco de dados PostgreSQL
(async () => {
    try {
        // Inicializar o banco de dados
        await initDatabase();
        logger.info('Banco de dados PostgreSQL inicializado com sucesso');
        
        // Criar módulo de exemplo para testes se necessário
        const createExampleModule = require('./scripts/seed-learning-module');
        await createExampleModule();
        
        // Executar verificações iniciais
        await initServer();
        
        // Iniciar o servidor
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            logger.info(`Servidor iniciado na porta ${PORT}`);
            console.log(`Servidor rodando em http://localhost:${PORT}`);
        });
    } catch (error) {
        logger.error('Falha ao iniciar o servidor:', error);
                process.exit(1);
    }
})();

module.exports = app;

