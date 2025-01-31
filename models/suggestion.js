const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
    sequentialNumber: {
        type: Number,
        unique: true
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
    }],
    imageUrl: {
        type: String,
        default: ''
    }
});

// Middleware para gerar número sequencial
suggestionSchema.pre('save', async function(next) {
    try {
        if (!this.sequentialNumber) {
            const lastSuggestion = await this.constructor.findOne()
                .sort({ sequentialNumber: -1 })
                .select('sequentialNumber');
                
            this.sequentialNumber = lastSuggestion ? (lastSuggestion.sequentialNumber + 1) : 1;
            console.log('Número sequencial definido:', this.sequentialNumber);
        }
        next();
    } catch (error) {
        console.error('Erro no middleware de sequentialNumber:', error);
        next(error);
    }
});

const Suggestion = mongoose.model('Suggestion', suggestionSchema);
module.exports = Suggestion; 