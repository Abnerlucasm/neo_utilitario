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
        default: 4848
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
        enum: ['active', 'inactive', 'stopped'],
        default: 'inactive'
    },
    pid: {
        type: Number
    },
    logsPath: {
        type: String,
        default: function() {
            return `glassfish6.2.5/glassfish/domains/${this.domain}/logs`;
        }
    },
    installPath: {
        type: String,
        required: [true, 'Caminho de instalação é obrigatório'],
        default: '/srv/glassfish6.2.5/'
    },
    setor: {
        type: String,
        enum: ['Setor Sup. Externo', 'Setor Sup. Interno'],
        required: [true, 'Setor é obrigatório'],
        default: 'Setor Sup. Externo'
    },
    accessType: {
        type: String,
        enum: ['local', 'external'],
        default: 'local'
    },
    inUse: {
        type: Boolean,
        default: false
    },
    currentUser: {
        type: String,
        default: ''
    },
    domainConfig: {
        serverName: String,
        user: String,
        password: String,
        databaseName: String
    },
    productionPort: {
        type: Number,
        default: 8091
    }
}, {
    timestamps: true
});

const Glassfish = mongoose.model('Glassfish', glassfishSchema);

module.exports = Glassfish; 