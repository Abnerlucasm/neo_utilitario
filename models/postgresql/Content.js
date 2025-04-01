const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const PostgresContent = sequelize.define('Content', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    content: {
        type: DataTypes.JSONB,
        defaultValue: {}
    },
    sections: {
        type: DataTypes.JSONB,
        defaultValue: []
    }
}, {
    tableName: 'contents',
    timestamps: true
});

// Método para converter Map para objeto (mantendo compatibilidade com MongoDB)
PostgresContent.prototype.toJSON = function() {
    const values = { ...this.get() };
    
    if (values.content instanceof Map) {
        const contentObj = {};
        values.content.forEach((value, key) => {
            contentObj[key] = value;
        });
        values.content = contentObj;
    }
    
    return values;
};

module.exports = PostgresContent; 