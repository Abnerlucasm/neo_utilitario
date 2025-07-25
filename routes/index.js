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
const userRoutes = require('./user');
const rolesRoutes = require('./roles');
const permissionsRoutes = require('./permissions');
const serverRoutes = require('./servers');
const resourcesRoutes = require('./resources');

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
router.use('/api/user', requireAuth, userRoutes);
router.use('/api/roles', [requireAuth, requireAdmin], rolesRoutes);
router.use('/api/permissions', [requireAuth, requireAdmin], permissionsRoutes);
router.use('/api', serverRoutes);
router.use('/api/resources', resourcesRoutes); // Temporariamente sem autenticação
router.use('/api/users', userRoutes); // Adicionada a rota para usuários

// Rota de diagnóstico
router.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        routes: [
            '/api/menus',
            '/api/auth',
            '/api/admin',
            '/api/user',
            '/api/roles',
            '/api/permissions',
            '/api/servers',
            '/api/resources'
        ]
    });
});

module.exports = router;