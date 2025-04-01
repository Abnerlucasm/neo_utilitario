'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('glassfish_servers', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            ip: {
                type: Sequelize.STRING,
                allowNull: false
            },
            admin_port: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 4848
            },
            http_port: {
                type: Sequelize.INTEGER,
                defaultValue: 8080
            },
            https_port: {
                type: Sequelize.INTEGER,
                defaultValue: 8181
            },
            domain: {
                type: Sequelize.STRING,
                allowNull: false
            },
            password: {
                type: Sequelize.STRING,
                defaultValue: 'admin'
            },
            ssh_username: {
                type: Sequelize.STRING,
                allowNull: false
            },
            ssh_password: {
                type: Sequelize.STRING,
                allowNull: false
            },
            install_path: {
                type: Sequelize.STRING,
                defaultValue: '/srv/glassfish6.2.5'
            },
            status: {
                type: Sequelize.ENUM('active', 'inactive'),
                defaultValue: 'inactive'
            },
            pid: {
                type: Sequelize.INTEGER
            },
            sector: {
                type: Sequelize.STRING,
                defaultValue: 'Cliente'
            },
            access_type: {
                type: Sequelize.ENUM('local', 'external'),
                defaultValue: 'local'
            },
            in_use: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            current_user: {
                type: Sequelize.STRING
            },
            production_port: {
                type: Sequelize.INTEGER,
                defaultValue: 8091
            },
            memory_usage: {
                type: Sequelize.FLOAT
            },
            cpu_usage: {
                type: Sequelize.FLOAT
            },
            last_check: {
                type: Sequelize.DATE
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('glassfish_servers');
    }
}; 