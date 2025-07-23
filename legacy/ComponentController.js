const { Component } = require('../models/postgresql/associations');
const logger = require('../utils/logger');

class ComponentController {
    static async list(req, res) {
        try {
            const components = await Component.findAll({
                where: {
                    is_active: true
                }
            });
            res.json(components);
        } catch (error) {
            logger.error('Erro ao listar componentes:', error);
            res.status(500).json({ error: 'Erro ao listar componentes' });
        }
    }

    static async get(req, res) {
        try {
            const component = await Component.findByPk(req.params.id);
            if (!component) {
                return res.status(404).json({ error: 'Componente não encontrado' });
            }
            res.json(component);
        } catch (error) {
            logger.error('Erro ao buscar componente:', error);
            res.status(500).json({ error: 'Erro ao buscar componente' });
        }
    }

    static async create(req, res) {
        try {
            const component = await Component.create({
                ...req.body,
                created_by: req.user.id
            });
            res.status(201).json(component);
        } catch (error) {
            logger.error('Erro ao criar componente:', error);
            res.status(500).json({ error: 'Erro ao criar componente' });
        }
    }

    static async update(req, res) {
        try {
            const component = await Component.findByPk(req.params.id);
            if (!component) {
                return res.status(404).json({ error: 'Componente não encontrado' });
            }
            await component.update(req.body);
            res.json(component);
        } catch (error) {
            logger.error('Erro ao atualizar componente:', error);
            res.status(500).json({ error: 'Erro ao atualizar componente' });
        }
    }

    static async delete(req, res) {
        try {
            const component = await Component.findByPk(req.params.id);
            if (!component) {
                return res.status(404).json({ error: 'Componente não encontrado' });
            }
            // Soft delete - apenas marca como inativo
            await component.update({ is_active: false });
            res.json({ message: 'Componente excluído com sucesso' });
        } catch (error) {
            logger.error('Erro ao excluir componente:', error);
            res.status(500).json({ error: 'Erro ao excluir componente' });
        }
    }
}

module.exports = ComponentController; 