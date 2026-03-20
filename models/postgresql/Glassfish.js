'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class Glassfish extends Model {
        static associate(models) {
            // Associações definidas em associations.js
        }

        // Virtual getter para compatibilidade com código legado que acessa service.ip
        get ip() {
            return this.host;
        }

        // Virtual getter para sshUsername
        get sshUsername() {
            return this.username;
        }

        // Virtual getter para sshPassword
        get sshPassword() {
            return this.config?.sshPassword || this.password;
        }

        // Virtual getter para installPath
        get installPath() {
            return this.config?.installPath || '/srv/glassfish6.2.5';
        }

        // Virtual setter para installPath (usado em getGlassfishPath)
        set installPath(value) {
            this.config = { ...this.config, installPath: value };
        }

        // Virtual getter para setor
        get setor() {
            return this.config?.setor || '';
        }

        // Virtual getter para accessType
        get accessType() {
            return this.config?.accessType || 'local';
        }

        // Virtual getter para productionPort
        get productionPort() {
            return this.config?.productionPort || 8080;
        }

        // Virtual getter para inUse
        get inUse() {
            return this.config?.inUse || false;
        }

        // Virtual getter para inUseBy
        get inUseBy() {
            return this.config?.inUseBy || '';
        }

        // Virtual getter para pid
        get pid() {
            return this.config?.pid || null;
        }

        // Virtual setter para pid
        set pid(value) {
            this.config = { ...this.config, pid: value };
        }

        // toJSON sobrescrito para incluir campos virtuais na serialização
        toJSON() {
            const values = super.toJSON();
            return {
                ...values,
                // campos virtuais mapeados das colunas reais
                ip:             this.ip,
                sshUsername:    this.sshUsername,
                sshPassword:    this.sshPassword,   // ← necessário para preencher o form de edição
                installPath:    this.installPath,
                setor:          this.setor,
                accessType:     this.accessType,
                productionPort: this.productionPort,
                inUse:          this.inUse,
                inUseBy:        this.inUseBy,
                pid:            this.pid,
            };
        }
    }

    Glassfish.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        // Armazenado como 'host' no banco, exposto como 'ip' via getter
        host: {
            type: DataTypes.STRING,
            allowNull: false
        },
        port: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 4848
        },
        // SSH username — armazenado como 'username'
        username: {
            type: DataTypes.STRING,
            allowNull: false
        },
        // SSH password fallback — dados sensíveis ficam no config JSONB
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        domain: {
            type: DataTypes.STRING,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive', 'error'),
            defaultValue: 'inactive'
        },
        last_check: {
            type: DataTypes.DATE
        },
        /**
         * config JSONB — campos armazenados aqui:
         *   sshPassword    : string  — senha SSH real
         *   installPath    : string  — caminho base do Glassfish
         *   productionPort : number  — porta da aplicação (padrão 8080)
         *   setor          : string  — setor de suporte
         *   accessType     : string  — 'local' | 'external'
         *   inUse          : boolean — se está em uso por alguém
         *   inUseBy        : string  — nome de quem está usando
         *   pid            : number  — PID do processo Java
         */
        config: {
            type: DataTypes.JSONB,
            defaultValue: {}
        }
    }, {
        sequelize,
        modelName: 'Glassfish',
        tableName: 'glassfish_servers',
        underscored: true
    });

    return Glassfish;
};