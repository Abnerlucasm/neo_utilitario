const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['correcao', 'melhoria', 'novo'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'implemented'],
        default: 'pending'
    },
    priority: {
        type: String,
        enum: ['baixa', 'media', 'alta'],
        required: true
    },
    createdBy: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const Suggestion = mongoose.model('Suggestion', suggestionSchema);
module.exports = Suggestion; 