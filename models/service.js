const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true
    },
    author: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const stepSchema = new mongoose.Schema({
    name: String,
    responsible: String,
    assignedTo: String,
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed'],
        default: 'pending'
    },
    order: {
        type: Number,
        default: 0
    },
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
    }
});

const timeEntrySchema = new mongoose.Schema({
    action: {
        type: String,
        enum: ['start', 'stop', 'reset'],
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    duration: {
        type: Number,
        default: 0
    }
});

const serviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: String,
    category: String,
    priority: {
        type: String,
        enum: ['baixa', 'media', 'alta'],
        default: 'media'
    },
    estimatedTime: Number,
    startDate: Date,
    endDate: Date,
    serviceStatus: {
        type: String,
        default: 'planejamento'
    },
    status: {
        type: String,
        enum: ['todo', 'in-progress', 'completed'],
        default: 'todo'
    },
    steps: [stepSchema],
    completedAt: {
        type: Date,
        default: null
    },
    timeHistory: [timeEntrySchema],
    timerActive: {
        type: Boolean,
        default: false
    },
    totalTimeSpent: {
        type: Number,
        default: 0
    },
    lastTimerUpdate: Date
}, { timestamps: true });

// Middleware para adicionar serviceId às etapas antes de salvar
serviceSchema.pre('save', function(next) {
    if (this.steps && this.steps.length > 0) {
        this.steps.forEach(step => {
            if (!step.serviceId) {
                step.serviceId = this._id;
            }
        });
    }
    next();
});

const Service = mongoose.model('Service', serviceSchema);
module.exports = Service; 