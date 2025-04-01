const Content = require('../models/Content');

class ContentController {
    static async get(req, res) {
        try {
            const { type } = req.params;
            const content = await Content.findOne({ type });
            
            if (!content) {
                // Se não existir, retornar conteúdo inicial vazio
                return res.json({
                    content: {},
                    sections: []
                });
            }
            
            res.json(content);
        } catch (error) {
            console.error('Erro ao buscar conteúdo:', error);
            res.status(500).json({ error: error.message });
        }
    }

    static async save(req, res) {
        try {
            const { type } = req.params;
            const { content, sections } = req.body;

            const result = await Content.findOneAndUpdate(
                { type },
                { type, content, sections },
                { new: true, upsert: true }
            );

            res.json({
                success: true,
                content: result
            });
        } catch (error) {
            console.error('Erro ao salvar conteúdo:', error);
            res.status(500).json({ error: error.message });
        }
    }

    static async update(req, res) {
        try {
            console.log('Recebendo atualização:', req.body);
            const { content, sections } = req.body;
            
            const updatedContent = await Content.findOneAndUpdate(
                { type: req.params.type },
                { 
                    content: new Map(Object.entries(content)),
                    sections,
                    updatedAt: new Date()
                },
                { new: true, upsert: true }
            );

            console.log('Conteúdo atualizado:', updatedContent);

            // Converter Map para objeto para enviar na resposta
            const contentObj = {};
            updatedContent.content.forEach((value, key) => {
                contentObj[key] = value;
            });

            const response = {
                success: true,
                content: {
                    type: updatedContent.type,
                    sections: updatedContent.sections,
                    content: contentObj
                }
            };

            console.log('Enviando resposta:', response);
            res.json(response);
        } catch (error) {
            console.error('Erro ao atualizar conteúdo:', error);
            res.status(400).json({ error: error.message });
        }
    }

    static async reload(req, res) {
        try {
            const content = await Content.findOne({ type: req.params.type });
            if (!content) {
                return res.status(404).json({ error: 'Conteúdo não encontrado' });
            }

            const contentObj = {};
            content.content.forEach((value, key) => {
                contentObj[key] = value;
            });

            res.json({
                type: content.type,
                sections: content.sections,
                content: contentObj
            });
        } catch (error) {
            console.error('Erro ao recarregar conteúdo:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = ContentController; 