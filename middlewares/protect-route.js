const { authMiddleware } = require('./auth-middleware');

const protectRoute = (req, res, next) => {
    const publicPages = ['login', 'register', 'forgot-password'];
    const page = req.params.page;

    if (publicPages.includes(page)) {
        return next();
    }

    return authMiddleware(req, res, next);
};

module.exports = protectRoute; 