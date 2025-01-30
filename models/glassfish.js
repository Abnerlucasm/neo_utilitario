const mongoose = require('mongoose');

const glassfishSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Nome é obrigatório']
    },
    ip: {
        type: String,
        required: [true, 'IP é obrigatório']
    },
    port: {
        type: Number,
        default: 8080
    },
    domain: {
        type: String,
        required: [true, 'Domínio é obrigatório']
    },
    password: {
        type: String,
        default: 'admin'
    },
    sshUsername: {
        type: String,
        required: [true, 'Usuário SSH é obrigatório']
    },
    sshPassword: {
        type: String,
        required: [true, 'Senha SSH é obrigatória']
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'inactive'
    },
    pid: {
        type: Number
    },
    logsPath: {
        type: String,
        default: 'glassfish6.2.5/glassfish/domains/neosistemas/logs'
    },
    installPath: {
        type: String,
        required: [true, 'Caminho de instalação é obrigatório'],
        default: '/srv/glassfish6.2.5'
    },
    categoria: {
        type: String,
        enum: ['Cliente', 'Neo'],
        required: [true, 'Categoria é obrigatória'],
        default: 'Cliente'
    },
    accessType: {
        type: String,
        enum: ['local', 'external'],
        default: 'local'
    }
}, {
    timestamps: true
});

const Glassfish = mongoose.model('Glassfish', glassfishSchema);

module.exports = Glassfish; 