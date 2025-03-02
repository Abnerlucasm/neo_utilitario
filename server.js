const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { createLogger, format, transports } = require('winston');
const { promisify } = require('util');
const { exec } = require('child_process');
const Glassfish = require('./models/glassfish');
const connectToDatabase = require('./db');
const { NodeSSH } = require('node-ssh');
const xml2js = require('xml2js');
const fsPromises = require('fs').promises;
const logger = require('./utils/logger');
const mongoose = require('mongoose');
const http = require('http');

// Importar routers
const glassfishRouter = require('./routes/glassfish');
const suggestionsRouter = require('./routes/suggestions'); // Outros routers, se existirem
const kanbanRouter = require('./routes/kanban');

// Importar controllers
const {
    timerController,
    archiveController,
    statusController,
    attachmentsController
} = require('./controllers/kanban');

const app = express();
const ssh = new NodeSSH();

// Criar servidor HTTP
const server = http.createServer(app);

// Utilitários de leitura e escrita de arquivos
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

// Caminhos dos arquivos
const CONFIG_PATH = path.join(__dirname, 'config.json');

// Middlewares básicos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ativa logs do Mongoose
mongoose.set('debug', true);

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/components', express.static(path.join(__dirname, 'public/components')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Configurar rotas do kanban
app.use('/api/kanban', kanbanRouter);

// Rota para estatísticas
kanbanRouter.get('/statistics', async (req, res) => {
    try {
        const stats = await Service.aggregate([
            {
                $group: {
                    _id: null,
                    activeServices: {
                        $sum: {
                            $cond: [{ $ne: ["$status", "completed"] }, 1, 0]
                        }
                    },
                    completedToday: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$status", "completed"] },
                                        {
                                            $gte: [
                                                "$completedAt",
                                                new Date(new Date().setHours(0, 0, 0, 0))
                                            ]
                                        }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    totalTime: { $sum: "$totalTimeSpent" }
                }
            }
        ]);

        const efficiency = await calculateEfficiency();
        
        res.json({
            activeServices: stats[0]?.activeServices || 0,
            completedToday: stats[0]?.completedToday || 0,
            totalTime: stats[0]?.totalTime || 0,
            efficiency
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

async function calculateEfficiency() {
    try {
        const completedServices = await Service.find({
            status: 'completed',
            completedAt: { $exists: true }
        });

        if (completedServices.length === 0) return 0;

        const totalEfficiency = completedServices.reduce((acc, service) => {
            const estimatedTime = service.estimatedTime || 0;
            const actualTime = service.totalTimeSpent || 0;
            
            if (estimatedTime === 0) return acc;
            
            const efficiency = (estimatedTime / actualTime) * 100;
            return acc + efficiency;
        }, 0);

        return Math.round(totalEfficiency / completedServices.length);
    } catch (error) {
        console.error('Erro ao calcular eficiência:', error);
        return 0;
    }
}

// Rota para a página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'index.html'));
});

// Rota para outras páginas HTML
app.get('/:page.html', (req, res, next) => {
    const pagePath = path.join(__dirname, 'public', 'pages', req.params.page + '.html');
    if (fs.existsSync(pagePath)) {
        res.sendFile(pagePath);
    } else {
        next(); // Passa para o próximo middleware se a página não existir
    }
});

// Logger middleware
app.use((req, res, next) => {
    logger.info(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

// Usar as rotas com prefixo /api
app.use('/api', glassfishRouter);
app.use('/api', suggestionsRouter);

// Rotas de configurações
app.get('/config', async (req, res) => {
    try {
        const configData = await readFileAsync(CONFIG_PATH, 'utf8');
        res.json(JSON.parse(configData));
    } catch (error) {
        console.error('Erro ao ler configurações:', error);
        res.status(500).json({ error: 'Erro ao ler configurações' });
    }
});

app.post('/config', async (req, res) => {
    try {
        const newConfig = req.body;
        await writeFileAsync(CONFIG_PATH, JSON.stringify(newConfig, null, 4));
        res.json({ message: 'Configurações atualizadas com sucesso' });
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
});

// Rotas para gerenciamento de sugestões
app.get('/suggestions', async (req, res) => {
    try {
        const data = await readFileAsync(SUGGESTIONS_PATH, 'utf8');
        const suggestions = JSON.parse(data || '[]');
        res.json(suggestions);
    } catch (error) {
        console.error('Erro ao carregar sugestões:', error);
        res.status(500).json({ error: 'Erro ao carregar sugestões' });
    }
});

app.post('/suggestions', async (req, res) => {
    try {
        const newSuggestion = req.body;
        newSuggestion.date = new Date().toISOString(); // Adiciona a data da solicitação

        const data = await readFileAsync(SUGGESTIONS_PATH, 'utf8');
        const suggestions = JSON.parse(data || '[]');
        suggestions.push(newSuggestion);

        await writeFileAsync(SUGGESTIONS_PATH, JSON.stringify(suggestions, null, 4));
        res.status(201).json({ message: 'Sugestão salva com sucesso!' });
    } catch (error) {
        console.error('Erro ao salvar sugestão:', error);
        res.status(500).json({ error: 'Erro ao salvar sugestão' });
    }
});

// Rota específica para o service worker
app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

// Rota para 404 - Not Found
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'pages', '404.html'));
});

// Tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: err.message 
    });
});

const PORT = process.env.PORT || 3010;

// Conectar ao MongoDB antes de iniciar o servidor
connectToDatabase()
    .then(() => {
        logger.info('Iniciando servidor...', {
            port: PORT,
            env: process.env.NODE_ENV,
            publicPath: path.join(__dirname, 'public')
        });

        // Criar servidor HTTP
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info('Servidor iniciado com sucesso', {
                port: PORT,
                address: server.address(),
                pid: process.pid
            });
        });

        // Tratamento de erros do servidor
        server.on('error', (error) => {
            logger.error('Erro no servidor:', {
                error: error.message,
                code: error.code
            });

            if (error.code === 'EADDRINUSE') {
                logger.error(`Porta ${PORT} já está em uso`);
                process.exit(1);
            }
        });
    })
    .catch(error => {
        logger.error('Falha ao iniciar servidor:', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    });

// Adicionar tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    logger.error('Erro não capturado:', {
        error: error.message,
        stack: error.stack
    });
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promessa rejeitada não tratada:', {
        reason: reason,
        promise: promise
    });
});

