const { Component } = require('../models/postgresql');
const logger = require('../utils/logger');

class ComponentController {
    static async list(req, res) {
        try {
            const components = await Component.findAll();
            res.json(components);
        } catch (error) {
            logger.error('Erro ao listar componentes:', error);
            res.status(500).json({ error: error.message });
        }
    }

    static async create(req, res) {
        try {
            const component = await Component.create(req.body);
            res.status(201).json(component);
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                res.status(400).json({ 
                    error: `Já existe um componente com o ID "${req.body.id}"` 
                });
            } else {
                logger.error('Erro ao criar componente:', error);
                res.status(400).json({ error: error.message });
            }
        }
    }

    static async update(req, res) {
        try {
            const [updated] = await Component.update(req.body, {
                where: { id: req.params.id }
            });
            
            if (!updated) {
                return res.status(404).json({ 
                    error: `Componente '${req.params.id}' não encontrado` 
                });
            }
            
            const component = await Component.findByPk(req.params.id);
            res.json(component);
        } catch (error) {
            logger.error('Erro ao atualizar componente:', error);
            res.status(400).json({ error: error.message });
        }
    }

    static async get(req, res) {
        try {
            const component = await Component.findByPk(req.params.id);
            if (!component) {
                return res.status(404).json({ 
                    error: `Componente '${req.params.id}' não encontrado` 
                });
            }
            res.json(component);
        } catch (error) {
            logger.error('Erro ao buscar componente:', error);
            res.status(500).json({ error: error.message });
        }
    }

    static async delete(req, res) {
        try {
            const deleted = await Component.destroy({
                where: { id: req.params.id }
            });
            
            if (!deleted) {
                return res.status(404).json({ error: 'Componente não encontrado' });
            }
            res.json({ message: 'Componente excluído com sucesso' });
        } catch (error) {
            logger.error('Erro ao excluir componente:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = ComponentController; 