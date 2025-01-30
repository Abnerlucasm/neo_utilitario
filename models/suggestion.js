const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
    sequentialNumber: {
        type: Number,
        required: true,
        unique: true
    },
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
    },
    votes: {
        type: Number,
        default: 0
    },
    upvotes: {
        type: Number,
        default: 0
    },
    downvotes: {
        type: Number,
        default: 0
    },
    votedBy: [{
        userId: String,
        voteType: String // 'up' ou 'down'
    }],
    comments: [{
        text: String,
        author: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
});

// Adicionar pré-save hook para gerar número sequencial
suggestionSchema.pre('save', async function(next) {
    if (!this.sequentialNumber) {
        try {
            const lastSuggestion = await this.constructor.findOne({}, {}, { sort: { sequentialNumber: -1 } });
            this.sequentialNumber = lastSuggestion ? lastSuggestion.sequentialNumber + 1 : 1;
        } catch (error) {
            return next(error);
        }
    }
    next();
});

const Suggestion = mongoose.model('Suggestion', suggestionSchema);
module.exports = Suggestion; 