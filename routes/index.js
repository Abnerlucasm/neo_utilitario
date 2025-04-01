// Consolidar importações de rotas
const glassfishRouter = require('./glassfish');
const suggestionsRouter = require('./suggestions');
const kanbanRouter = require('./kanban');
const contentRouter = require('./content');
const componentsRouter = require('./components');
const progressRouter = require('./progress');
const learningRouter = require('./learning');
const path = require('path');
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const checkAccess = require('../middleware/checkAccess');

module.exports = function(app) {
    // API routes
    app.use('/api/glassfish', glassfishRouter);
    app.use('/api/suggestions', suggestionsRouter);
    app.use('/api/kanban', kanbanRouter);
    app.use('/api/content', contentRouter);
    app.use('/api/components', componentsRouter);
    app.use('/api/progress', progressRouter);
    app.use('/api/learning', learningRouter);

    // Rota para a página de aprendizagem
    app.get('/learn', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/learn.html'));
    });

    // Rota protegida que requer autenticação e acesso específico
    router.get('/sugestoes', 
        authenticate, 
        checkAccess('/sugestoes'),
        (req, res) => {
            // Lógica da rota
        }
    );

    // Rota de admin que requer autenticação e acesso específico
    router.get('/admin/users', 
        authenticate, 
        checkAccess('/admin/users'),
        (req, res) => {
            // Lógica da rota
        }
    );

    return router;
}; 