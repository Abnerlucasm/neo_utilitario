'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        try {
            // Verificar se a tabela existe
            const tableInfo = await queryInterface.describeTable('user_sessions')
                .catch(() => null);

            if (!tableInfo) {
                await queryInterface.createTable('user_sessions', {
                    sid: {
                        type: Sequelize.STRING,
                        primaryKey: true
                    },
                    sess: {
                        type: Sequelize.JSON,
                        allowNull: false
                    },
                    expire: {
                        type: Sequelize.DATE,
                        allowNull: false
                    }
                }, { transaction });

                // Verificar se o índice existe
                const [indexes] = await queryInterface.sequelize.query(
                    `SELECT indexname FROM pg_indexes WHERE indexname = 'IDX_session_expire'`,
                    { transaction }
                );

                if (!indexes.length) {
                    await queryInterface.addIndex('user_sessions', ['expire'], {
                        name: 'IDX_session_expire',
                        transaction
                    });
                }
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        try {
            await queryInterface.sequelize.query(
                `DROP INDEX IF EXISTS "IDX_session_expire"`,
                { transaction }
            );
            await queryInterface.dropTable('user_sessions', { transaction });
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}; 