const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const { User, Role, Permission } = require('../models/postgresql');
const logger = require('../utils/logger');

module.exports = function(app) {
    // Inicializar Passport
    app.use(passport.initialize());
    app.use(passport.session());

    // Configurar estratégia local
    passport.use(new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password'
    }, async (email, password, done) => {
        try {
            const user = await User.findOne({
                where: { email },
                include: [{
                    model: Role,
                    as: 'userRoles'
                }]
            });

            if (!user) {
                return done(null, false, { message: 'Email não encontrado' });
            }

            if (!user.email_verified) {
                return done(null, false, { 
                    message: 'Email não verificado',
                    redirect: '/verify-email'
                });
            }

            const isValid = await user.validatePassword(password);
            if (!isValid) {
                return done(null, false, { message: 'Senha incorreta' });
            }

            return done(null, user);
        } catch (error) {
            logger.error('Erro na autenticação:', error);
            return done(error);
        }
    }));

    // Serialização do usuário
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialização do usuário
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findByPk(id, {
                include: [{
                    model: Role,
                    as: 'userRoles'
                }]
            });
            done(null, user);
        } catch (error) {
            done(error);
        }
    });
}; 