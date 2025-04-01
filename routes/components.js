const express = require('express');
const router = express.Router();
const ComponentController = require('../controllers/ComponentController');
const { ensureAdmin } = require('../middlewares/ensure-admin');

// Rotas para gerenciar componentes
router.get('/', ComponentController.list);
router.get('/:id', ComponentController.get);
router.post('/', ensureAdmin, ComponentController.create);
router.put('/:id', ensureAdmin, ComponentController.update);
router.delete('/:id', ensureAdmin, ComponentController.delete);

module.exports = router; 