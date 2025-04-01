const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Suggestion extends Model {}

Suggestion.init({
    sequentialNumber: {
        type: DataTypes.INTEGER,
        unique: true,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    category: {
        type: DataTypes.ENUM('correcao', 'melhoria', 'novo'),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'in_progress', 'implemented'),
        defaultValue: 'pending'
    },
    createdBy: {
        type: DataTypes.STRING,
        allowNull: false
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    votes: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    upvotes: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    downvotes: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    votedBy: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    comments: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    imageUrl: {
        type: DataTypes.STRING,
        defaultValue: ''
    }
}, {
    sequelize,
    modelName: 'Suggestion',
    hooks: {
        beforeCreate: async (suggestion, options) => {
            if (!suggestion.sequentialNumber) {
                const lastSuggestion = await Suggestion.findOne({
                    order: [['sequentialNumber', 'DESC']],
                    attributes: ['sequentialNumber']
                });
                
                suggestion.sequentialNumber = lastSuggestion ? (lastSuggestion.sequentialNumber + 1) : 1;
                console.log('Número sequencial definido:', suggestion.sequentialNumber);
            }
        }
    }
});

module.exports = Suggestion; 