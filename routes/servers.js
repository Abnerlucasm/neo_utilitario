const express = require('express');
const router = express.Router();
const ensureAuthenticated = require('../middlewares/auth');
const serverController = require('../controllers/server.controller');

// Aplicar middleware de autenticação em todas as rotas
router.use(ensureAuthenticated);

// Rotas para gerenciamento de servidores
router.get('/servers', serverController.listServers);
router.get('/servers/:id', serverController.getServer);
router.post('/servers', serverController.createServer);
router.put('/servers/:id', serverController.updateServer);
router.delete('/servers/:id', serverController.deleteServer);

// Rotas para operações de banco de dados
router.post('/servers/:id/test-connection', serverController.testConnection);
router.post('/servers/execute-query', serverController.executeQuery);
router.post('/servers/list-databases', serverController.listDatabases);
router.get('/servers/stats/overview', serverController.getServerStats);

module.exports = router; 