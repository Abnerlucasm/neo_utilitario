const authMiddleware = (req, res, next) => {
    // Verificar se o usuário está autenticado
    if (req.session && req.session.user) {
        return next();
    }
    
    // Se não estiver autenticado, redirecionar para a página de login
    res.redirect('/pages/login.html');
};

module.exports = {
    authMiddleware
}; 