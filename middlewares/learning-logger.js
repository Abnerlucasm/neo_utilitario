const learningLogger = (req, res, next) => {
    if (req.path.startsWith('/api/learning')) {
        logger.info(`${req.method} ${req.path}`, {
            user: req.user?.id,
            params: req.params,
            query: req.query
        });
    }
    next();
}; 