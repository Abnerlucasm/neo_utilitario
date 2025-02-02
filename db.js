const mongoose = require('mongoose');
const logger = require('./utils/logger');

async function connectToDatabase() {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/neoutilitario';
        
        await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4, // Force IPv4
            maxPoolSize: 10
        });

        logger.info('Conectado ao MongoDB com sucesso');
        
        // Listeners para eventos de conexão
        mongoose.connection.on('error', (err) => {
            logger.error('Erro na conexão MongoDB:', err);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB desconectado');
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconectado');
        });

    } catch (error) {
        logger.error('Erro ao conectar ao MongoDB:', error);
        throw error;
    }
}

module.exports = connectToDatabase;
