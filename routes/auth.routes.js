const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const require2FA = require('../middlewares/two-factor');

// Rotas de autenticação
router.post('/login', require2FA, authController.login);
router.post('/register', authController.register);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/logout', authController.logout);

module.exports = router; 