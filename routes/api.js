const express = require('express');
const router = express.Router();
const ComponentController = require('../controllers/ComponentController');
const ContentController = require('../controllers/ContentController');
const learningController = require('../controllers/learning.controller');

// Rotas de componentes
router.get('/components', ComponentController.list);
router.post('/components', ComponentController.create);
router.put('/components/:id', ComponentController.update);
router.delete('/components/:id', ComponentController.delete);

// Rotas de conteúdo
router.get('/content/:type', ContentController.get);
router.post('/content/:type', ContentController.update);
router.post('/content/:type/reload', ContentController.reload);

// Rotas de aprendizagem
router.get('/learning/:type', learningController.getContent);

module.exports = router; 