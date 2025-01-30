const mongoose = require('mongoose');
const logger = require('./utils/logger');

async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        logger.info('Conectado ao MongoDB com sucesso');
    } catch (error) {
        logger.error('Erro ao conectar ao MongoDB:', error);
        throw error;
    }
}

module.exports = connectToDatabase;
