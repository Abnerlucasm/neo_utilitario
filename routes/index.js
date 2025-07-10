/**
 * Arquivo de rotas principal
 * Registra todas as rotas da aplicação
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { requireAuth, requireAdmin } = require('../middlewares/access-control');

// Importar rotas
const menuRoutes = require('./menus');
const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const learningRoutes = require('./learning');
const userRoutes = require('./user');
const rolesRoutes = require('./roles');
const progressRoutes = require('./progress');
<<<<<<< HEAD
const serverRoutes = require('./servers');
=======
const resourcesRoutes = require('./resources');
>>>>>>> c8d6dac1767d65f5298aba35e5d7d8aa53e3d592

// Configuração de logging para diagnóstico de rotas
router.use((req, res, next) => {
    logger.info(`Requisição recebida: ${req.method} ${req.originalUrl}`);
    next();
});

// Registro de rotas
console.log('Registrando rota /api/menus na routes/index.js');
// Aplicar middleware de autenticação - mas não aqui pois já está no arquivo de rota
router.use('/api/menus', menuRoutes);
router.use('/api/auth', authRoutes);
router.use('/api/admin', [requireAuth, requireAdmin], adminRoutes);
router.use('/api/learning', requireAuth, learningRoutes);
router.use('/api/user', requireAuth, userRoutes);
router.use('/api/roles', [requireAuth, requireAdmin], rolesRoutes);
router.use('/api/progress', requireAuth, progressRoutes);
<<<<<<< HEAD
router.use('/api', serverRoutes);
=======
router.use('/api/resources', [requireAuth, requireAdmin], resourcesRoutes);
>>>>>>> c8d6dac1767d65f5298aba35e5d7d8aa53e3d592

// Rota de diagnóstico
router.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        routes: [
            '/api/menus',
            '/api/auth',
            '/api/admin',
            '/api/learning',
            '/api/user',
            '/api/roles',
            '/api/progress',
<<<<<<< HEAD
            '/api/servers'
=======
            '/api/resources'
>>>>>>> c8d6dac1767d65f5298aba35e5d7d8aa53e3d592
        ]
    });
});

module.exports = router; 