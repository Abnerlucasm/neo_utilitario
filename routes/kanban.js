const express = require('express');
const router = express.Router();
const Service = require('../models/service');

// Listar serviços
router.get('/services', async (req, res) => {
    try {
        const services = await Service.find()
            .sort({ createdAt: -1 });
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar serviços' });
    }
});

// Criar novo serviço
router.post('/services', async (req, res) => {
    try {
        const service = new Service(req.body);
        await service.save();
        res.status(201).json(service);
    } catch (error) {
        console.error('Erro ao criar serviço:', error);
        res.status(400).json({ error: 'Erro ao criar serviço' });
    }
});

// Atualizar status do serviço
router.patch('/services/:id/status', async (req, res) => {
    try {
        const { status, serviceStatus } = req.body;
        const updates = {
            status,
            serviceStatus,
            updatedAt: new Date()
        };

        // Se movido para concluído, adicionar data de conclusão
        if (status === 'completed') {
            updates.completedAt = new Date();
        }

        const service = await Service.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true }
        );

        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        // Calcular serviços concluídos hoje
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const completedToday = await Service.countDocuments({
            status: 'completed',
            completedAt: { $gte: today },
            archived: { $ne: true }
        });

        res.json({ 
            service, 
            completedToday 
        });
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

// Adicionar estas rotas
router.patch('/services/:id/timer', async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        const { action, timeSpent } = req.body;
        const now = new Date();

        service.timerActive = action === 'start';
        service.totalTimeSpent = timeSpent;
        service.lastTimerUpdate = now;

        if (!service.timeHistory) service.timeHistory = [];
        service.timeHistory.push({
            action,
            date: now,
            duration: timeSpent
        });

        await service.save();
        res.json(service);
    } catch (error) {
        console.error('Erro no timer:', error);
        res.status(500).json({ error: 'Erro ao atualizar timer' });
    }
});

router.post('/services/:id/timer/finish', async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        const { finalTime } = req.body;

        service.timerActive = false;
        service.timerFinished = true;
        service.totalTimeSpent = finalTime;
        service.timerStartTime = null;
        service.timeHistory.push({
            action: 'finish',
            date: new Date(),
            duration: finalTime
        });

        await service.save();

        // Atualizar estatísticas
        const totalTime = await Service.aggregate([
            { $match: { archived: { $ne: true } } },
            { $group: { _id: null, total: { $sum: '$totalTimeSpent' } } }
        ]);

        res.json({
            service,
            totalTime: totalTime[0]?.total || 0
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao finalizar timer' });
    }
});

// Adicionar esta rota
router.get('/statistics', async (req, res) => {
    try {
        const period = req.query.period || 'all';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let dateFilter = {};
        if (period === 'day') {
            dateFilter = { createdAt: { $gte: today } };
        } else if (period === 'week') {
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            dateFilter = { createdAt: { $gte: weekStart } };
        }

        const [activeServices, completedToday, totalTimeResult] = await Promise.all([
            Service.countDocuments({ 
                status: { $ne: 'completed' },
                ...dateFilter
            }),
            Service.countDocuments({
                status: 'completed',
                completedAt: { $gte: today },
                ...dateFilter
            }),
            Service.aggregate([
                { $match: dateFilter },
                { $group: { _id: null, total: { $sum: '$totalTimeSpent' } } }
            ])
        ]);

        res.json({
            activeServices,
            completedToday,
            totalTime: totalTimeResult[0]?.total || 0,
            efficiency: calculateEfficiency(completedToday, activeServices)
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

function calculateEfficiency(completed, active) {
    if (active === 0) return 100;
    return Math.round((completed / (completed + active)) * 100);
}

// Adicionar rota para arquivar serviço
router.patch('/services/:id/archive', async (req, res) => {
    try {
        const service = await Service.findByIdAndUpdate(
            req.params.id,
            { 
                archived: true,
                status: 'archived' // Adicionar status específico para arquivados
            },
            { new: true }
        );
        
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }
        
        // Recalcular estatísticas após arquivar
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [activeServices, completedToday] = await Promise.all([
            Service.countDocuments({ 
                status: { $ne: 'completed' },
                archived: { $ne: true }
            }),
            Service.countDocuments({
                status: 'completed',
                completedAt: { $gte: today },
                archived: { $ne: true }
            })
        ]);

        res.json({
            ...service.toObject(),
            stats: {
                activeServices,
                completedToday
            }
        });
    } catch (error) {
        console.error('Erro ao arquivar serviço:', error);
        res.status(500).json({ error: 'Erro ao arquivar serviço' });
    }
});

// Adicionar rota para excluir serviço
router.delete('/services/:id', async (req, res) => {
    try {
        const service = await Service.findByIdAndDelete(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }
        res.json({ message: 'Serviço excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir serviço' });
    }
});

// Atualizar serviço
router.patch('/services/:id/update', async (req, res) => {
    try {
        // Remover campos que não devem ser atualizados diretamente
        const updateData = { ...req.body };
        delete updateData.timeHistory;
        delete updateData.timerStartTime;
        delete updateData.timerActive;

        // Garantir que as etapas mantenham seus IDs
        if (updateData.steps) {
            const service = await Service.findById(req.params.id);
            if (service && service.steps) {
                updateData.steps = updateData.steps.map((step, index) => {
                    const existingStep = service.steps[index];
                    if (existingStep && existingStep._id) {
                        return { ...step, _id: existingStep._id };
                    }
                    return step;
                });
            }
        }

        const service = await Service.findByIdAndUpdate(
            req.params.id,
            updateData,
            { 
                new: true,
                runValidators: true
            }
        );
        
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }
        
        res.json(service);
    } catch (error) {
        console.error('Erro ao atualizar serviço:', error);
        res.status(500).json({ error: 'Erro ao atualizar serviço' });
    }
});

// Rota para desarquivar
router.patch('/services/:id/unarchive', async (req, res) => {
    try {
        const service = await Service.findByIdAndUpdate(
            req.params.id,
            { 
                archived: false,
                status: 'todo' // Volta para o quadro "A Fazer"
            },
            { new: true }
        );
        
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }
        
        res.json(service);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao desarquivar serviço' });
    }
});

// Adicionar rota para obter um serviço específico
router.get('/services/:id', async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }
        res.json(service);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar serviço' });
    }
});

// Rota para obter histórico de tempo
router.get('/services/:id/time-history', async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        // Ordenar entradas por data, mais recentes primeiro
        const entries = (service.timeHistory || []).sort((a, b) => b.date - a.date);

        res.json({ entries });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar histórico de tempo' });
    }
});

// Atualizar etapas do serviço
router.patch('/services/:id/steps', async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        service.steps = req.body.steps;
        await service.save();
        
        res.json(service);
    } catch (error) {
        console.error('Erro ao atualizar etapas:', error);
        res.status(500).json({ error: 'Erro ao atualizar etapas' });
    }
});

// Atualizar status de uma etapa específica
router.patch('/services/:serviceId/steps/:stepId/status', async (req, res) => {
    try {
        const { serviceId, stepId } = req.params;
        const { status } = req.body;

        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }

        // Encontrar e atualizar a etapa específica
        const step = service.steps.id(stepId);
        if (!step) {
            return res.status(404).json({ error: 'Etapa não encontrada' });
        }

        step.status = status;
        await service.save();

        res.json(service);
    } catch (error) {
        console.error('Erro ao atualizar status da etapa:', error);
        res.status(500).json({ error: 'Erro ao atualizar status da etapa' });
    }
});

module.exports = router; 