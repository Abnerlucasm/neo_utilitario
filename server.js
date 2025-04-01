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
const { sequelize } = require('./config/database');
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
const { initDatabase } = require('./models/postgresql');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const userRouter = require('./routes/user');

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
const menusRouter = require('./routes/menus');

// Importar controllers
const {
    timerController,
    archiveController,
    statusController,
    attachmentsController
} = require('./controllers/kanban');

// Importar rotas de administração
const adminRouter = require('./routes/admin');

// Importar script de seed de menus
const seedMenus = require('./scripts/seed-menus');

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Servir arquivos estáticos ANTES do middleware de autenticação
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use('/modules', express.static(path.join(__dirname, 'public/modules')));
app.use('/styles', express.static(path.join(__dirname, 'public/styles')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// Middleware de autenticação
const authMiddleware = async (req, res, next) => {
    // Rotas públicas que não precisam de autenticação
    const publicPaths = [
        '/pages/login.html',
        '/pages/register.html',
        '/pages/forgot-password.html',
        '/api/auth/login',
        '/api/auth/register',
        '/styles/',
        '/js/',
        '/assets/',
        '/components/',
        '/favicon.ico',
        '/modules/learning/templates/',
        '/modules/learning/js/auth-debug.js'
    ];

    // Verificar se é uma rota pública
    if (publicPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    try {
        // Extrair token do cookie ou do header Authorization (limpando possíveis prefixos)
        let token = req.cookies.auth_token;
        
        if (!token && req.headers.authorization) {
            // Limpar prefixos como "Bearer " se existirem
            token = req.headers.authorization.replace(/^(Bearer|Token)\s+/i, '');
        }

        if (!token) {
            logger.debug('Token não fornecido', {
                path: req.path,
                method: req.method,
                headers: req.headers.authorization ? 'Authorization presente' : 'Sem Authorization'
            });
            throw new Error('Token não fornecido');
        }

        // Verificar e decodificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
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

// Rota específica para learn.html
app.get('/pages/learn.html', authMiddleware, (req, res) => {
    const learningHubPath = path.join(__dirname, 'public/modules/learning/templates/learn.html');
    
    logger.debug('Tentando acessar learn.html', {
        path: learningHubPath,
        exists: fs.existsSync(learningHubPath),
        user: req.user?.id
    });

    if (fs.existsSync(learningHubPath)) {
        res.sendFile(learningHubPath);
    } else {
        logger.error('Arquivo learn.html não encontrado');
        res.status(503).send('Módulo de aprendizado em manutenção. Por favor, tente novamente mais tarde.');
    }
});

// Aplicar middleware de autenticação para rotas protegidas
app.use('/api/user', authMiddleware, userRouter);
app.use('/api/learning', authMiddleware, learningRouter);
app.use('/api/glassfish', authMiddleware, glassfishRouter);
app.use('/api/suggestions', authMiddleware, suggestionsRouter);
app.use('/api/kanban', authMiddleware, kanbanRouter);
app.use('/api/content', authMiddleware, contentRouter);
app.use('/api/components', authMiddleware, componentsRouter);
app.use('/api/progress', authMiddleware, progressRouter);

// Rotas públicas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'register.html'));
});

// Adicionar rotas diretas para as páginas de login e registro
app.get('/pages/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'login.html'));
});

app.get('/pages/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'register.html'));
});

app.get('/verify-email', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'verify-email.html'));
});

// Rotas de administração do módulo learning
app.use('/admin/learning', authMiddleware, (req, res, next) => {
    try {
        // Verificar se o usuário está autenticado e é admin
        if (!req.user) {
            logger.error('Tentativa de acesso admin sem autenticação:', { path: req.path });
            return res.status(401).json({ error: 'Acesso negado. Autenticação necessária.' });
        }

        // Verificar se o usuário tem a role admin
        const isAdmin = req.isAdmin || (req.user.userRoles && 
                       req.user.userRoles.some(role => role.name.toLowerCase() === 'admin'));

        if (!isAdmin) {
            logger.error('Tentativa de acesso admin sem permissão:', { 
                path: req.path, 
                userId: req.user.id,
                email: req.user.email
            });
            return res.status(403).json({ error: 'Acesso negado. Permissão de administrador necessária.' });
        }

        // Log de acesso permitido
        logger.info('Acesso admin permitido:', { 
            path: req.path, 
            userId: req.user.id,
            email: req.user.email
        });
        
        next();
    } catch (error) {
        logger.error('Erro ao acessar área admin:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota específica para servir a página de administração de módulos
app.get('/admin/learning/modules', authMiddleware, (req, res, next) => {
    try {
        // Verificar se é admin
        if (!req.isAdmin && (!req.user.userRoles || 
            !req.user.userRoles.some(role => role.name.toLowerCase() === 'admin'))) {
            logger.warn('Tentativa de acesso admin negada:', {
                path: req.path,
                user: req.user.id
            });
            return res.status(403).redirect('/pages/login.html');
        }
        
        const filePath = path.join(__dirname, 'public/modules/learning/templates/modules.html');
        
        logger.debug('Servindo página admin learning modules:', { 
            filePath, 
            exists: fs.existsSync(filePath),
            user: req.user?.id,
            email: req.user?.email
        });
        
        // Verificar se o arquivo existe
        if (!fs.existsSync(filePath)) {
            logger.error('Arquivo modules.html não encontrado:', filePath);
            return res.status(404).send('Página não encontrada');
        }
        
        // Enviar o arquivo
        res.sendFile(filePath);
    } catch (error) {
        logger.error('Erro ao carregar página de admin:', error);
        res.status(500).send('Erro ao carregar página');
    }
});

// Rota para o editor de módulos (novo ou edição)
app.get('/admin/learning/module/:action', authMiddleware, (req, res, next) => {
    try {
        // Verificar se é admin
        if (!req.isAdmin && (!req.user.userRoles || 
            !req.user.userRoles.some(role => role.name.toLowerCase() === 'admin'))) {
            logger.warn('Tentativa de acesso admin negada:', {
                path: req.path,
                user: req.user.id
            });
            return res.status(403).redirect('/pages/login.html');
        }
        
        // Redirecionamos para a página principal de módulos, 
        // mas com um parâmetro que indica que queremos mostrar o editor
        // Isso evita problemas com caminhos relativos
        let redirectUrl = '/admin/learning/modules';
        
        // Verificar se é edição ou criação
        if (req.params.action === 'new') {
            redirectUrl += '?action=new';
        } else if (!isNaN(req.params.action)) {
            // Se for um número, assumimos que é um ID de módulo para edição
            redirectUrl += `?action=edit&id=${req.params.action}`;
        }
        
        logger.debug('Redirecionando para editor de módulos:', { 
            redirectUrl,
            user: req.user?.id,
            email: req.user?.email
        });
        
        // Redirecionar para a página principal com parâmetros
        res.redirect(redirectUrl);
    } catch (error) {
        logger.error('Erro ao processar rota do editor de módulos:', error);
        res.status(500).send('Erro ao processar requisição');
    }
});

// Rota para outras páginas HTML protegidas
app.get('/:page.html', authMiddleware, (req, res, next) => {
    const pagePath = path.join(__dirname, 'public', 'pages', req.params.page + '.html');
    if (fs.existsSync(pagePath)) {
        res.sendFile(pagePath);
    } else {
        next();
    }
});

// Rota para o editor de conteúdo do módulo
app.get('/learning/admin/module/content/:id', authMiddleware, (req, res, next) => {
    try {
        // Verificar se é admin
        if (!req.isAdmin && (!req.user.userRoles || 
            !req.user.userRoles.some(role => role.name.toLowerCase() === 'admin'))) {
            logger.warn('Tentativa de acesso ao editor de conteúdo negada:', {
                path: req.path,
                user: req.user.id
            });
            return res.status(403).redirect('/pages/login.html');
        }
        
        const filePath = path.join(__dirname, 'public/modules/learning/templates/module-content-editor.html');
        
        logger.debug('Servindo página do editor de conteúdo:', { 
            filePath, 
            exists: fs.existsSync(filePath),
            user: req.user?.id,
            email: req.user?.email
        });
        
        // Verificar se o arquivo existe
        if (!fs.existsSync(filePath)) {
            logger.error('Arquivo module-content-editor.html não encontrado:', filePath);
            return res.status(404).send('Página não encontrada');
        }
        
        // Enviar o arquivo
        res.sendFile(filePath);
    } catch (error) {
        logger.error('Erro ao carregar página do editor de conteúdo:', error);
        res.status(500).send('Erro ao carregar página');
    }
});

// Rotas administrativas
app.use('/api/admin', [authMiddleware, requireAdmin], adminRouter);
app.use('/api/roles', [authMiddleware, requireAdmin], rolesRouter);
app.use('/api/menus', [authMiddleware, requireAdmin], menusRouter);

// Rota para páginas administrativas
app.get('/pages/admin/*', [authMiddleware, requireAdmin], (req, res) => {
    const pagePath = path.join(__dirname, 'public', req.path);
    if (fs.existsSync(pagePath)) {
        res.sendFile(pagePath);
    } else {
        res.status(404).sendFile(path.join(__dirname, 'public', 'pages', '404.html'));
    }
});

// Adicionar novas rotas para configurações do usuário
app.get('/api/user/settings', authMiddleware, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        const user = await User.findByPk(req.user.id, {
            attributes: ['id', 'username', 'email', 'theme']
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json({
            id: user.id,
            name: user.username,
            email: user.email,
            theme: user.theme
        });

    } catch (error) {
        console.error('Erro ao buscar configurações:', error);
        res.status(500).json({ error: 'Erro interno ao carregar configurações' });
    }
});

app.post('/api/user/settings', authMiddleware, async (req, res) => {
    try {
        const { name, email, theme, password } = req.body;
        const user = await User.findByPk(req.user.id);

        if (user) {
            user.name = name;
            user.email = email;
            user.theme = theme;
            if (password) {
                user.password = await bcrypt.hash(password, 10);
            }
            await user.save();
            res.json({ message: 'Configurações atualizadas com sucesso' });
        } else {
            res.status(404).json({ error: 'Usuário não encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
});

// Rota para a página de configurações do usuário
app.get('/user-settings.html', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'user-settings.html'));
});

// Rota para páginas HTML
app.get('*.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', req.path));
});

// Rota para visualizar módulos de aprendizado
app.get('/learn/:id', (req, res) => {
    const moduleId = req.params.id;
    const moduleViewPath = path.join(__dirname, 'public/modules/learning/templates/module-view.html');
    
    logger.info('Acessando módulo de aprendizado:', {
        moduleId: moduleId,
        path: moduleViewPath,
        user: req.user?.id
    });
    
    if (fs.existsSync(moduleViewPath)) {
        res.sendFile(moduleViewPath);
    } else {
        logger.error('Arquivo module-view.html não encontrado', {
            moduleId: moduleId,
            path: moduleViewPath
        });
        res.status(404).sendFile(path.join(__dirname, 'public', 'pages', '404.html'));
    }
});

// Rota 404 - deve ser a última
app.use((req, res) => {
    if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Endpoint não encontrado' });
    }
    // Log para debug
    logger.warn('Página não encontrada:', {
        path: req.path,
        method: req.method,
        isXHR: req.xhr
    });
    res.status(404).sendFile(path.join(__dirname, 'public', 'pages', '404.html'));
});

// Função para atualizar usuários existentes
async function updateExistingUsers() {
    try {
        const users = await User.findAll({
            where: {
                name: null
            }
        });

        for (const user of users) {
            user.name = user.username;
            await user.save();
        }

        logger.info('Usuários existentes atualizados com sucesso');
    } catch (error) {
        logger.error('Erro ao atualizar usuários existentes:', error);
    }
}

// Função para inicializar o aplicativo
async function initializeApp() {
    try {
        // Inicializar banco de dados
        await initDatabase();
        
        // Verificar e criar menus padrão se necessário
        try {
            logger.info('Verificando menus do sistema...');
            await seedMenus();
            logger.info('Verificação de menus concluída com sucesso');
        } catch (error) {
            logger.error('Erro ao verificar/criar menus:', error);
            // Continuar a inicialização mesmo com erro nos menus
        }
        
        // Verificar e criar usuário admin se necessário
        try {
            await ensureAdmin();
            logger.info('Verificação de usuário admin concluída com sucesso');
        } catch (error) {
            logger.error('Erro ao verificar/criar usuário admin:', error);
            // Continuar a inicialização mesmo com erro no admin
        }
        
        // Iniciar servidor
        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            logger.info(`Servidor iniciado na porta ${port}`);
        });
        
        return true;
    } catch (error) {
        logger.error('Erro ao inicializar aplicativo:', error);
        throw error;
    }
}

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    logger.error('Erro não capturado:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promessa rejeitada não tratada:', reason);
    process.exit(1);
});

// Inicializar aplicação com retry
async function startServer(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await initializeApp();
            return;
        } catch (error) {
            logger.error(`Tentativa ${i + 1} de ${retries} falhou:`, error);
            if (i === retries - 1) {
                logger.error('Todas as tentativas falharam. Encerrando aplicação.');
                process.exit(1);
            }
            // Esperar 2 segundos antes de tentar novamente
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

startServer().catch(error => {
    logger.error('Erro fatal ao inicializar aplicação:', error);
    process.exit(1);
});

// Limpar sessões expiradas periodicamente
setInterval(async () => {
    try {
        await Session.destroy({
            where: {
                expires: {
                    [Op.lt]: new Date()
                }
            }
        });
        logger.debug('Sessões expiradas removidas');
    } catch (error) {
        logger.error('Erro ao limpar sessões expiradas:', error);
    }
}, 15 * 60 * 1000); // Executar a cada 15 minutos

module.exports = app;

