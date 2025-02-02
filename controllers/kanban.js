const Service = require('../models/service');

exports.timerController = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, timeSpent } = req.body;
        
        const service = await Service.findById(id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }
        
        service.timerActive = action === 'start';
        service.totalTimeSpent = timeSpent;
        service.lastTimerUpdate = new Date();
        
        await service.save();
        res.json(service);
    } catch (error) {
        console.error('Erro ao atualizar timer:', error);
        res.status(500).json({ error: 'Erro ao atualizar timer' });
    }
};

exports.archiveController = async (req, res) => {
    try {
        const { id } = req.params;
        const service = await Service.findById(id);
        
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }
        
        service.archived = true;
        service.status = 'archived';
        await service.save();
        
        res.json(service);
    } catch (error) {
        console.error('Erro ao arquivar serviço:', error);
        res.status(500).json({ error: 'Erro ao arquivar serviço' });
    }
};

exports.statusController = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, serviceStatus } = req.body;
        
        const service = await Service.findById(id);
        if (!service) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }
        
        service.status = status;
        if (serviceStatus) {
            service.serviceStatus = serviceStatus;
        }
        
        if (status === 'completed') {
            service.completedAt = new Date();
        }
        
        await service.save();
        res.json({ service });
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
}; 