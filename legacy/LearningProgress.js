const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const LearningProgress = sequelize.define('LearningProgress', {
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    moduleId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    pageId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    completed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    score: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    lastAccess: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
});

module.exports = LearningProgress; 