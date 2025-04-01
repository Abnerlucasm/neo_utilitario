'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            // 1. Criar extensão uuid se não existir
            await queryInterface.sequelize.query(`
                CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            `);

            // 2. Remover todas as foreign keys existentes
            await queryInterface.sequelize.query(`
                DO $$ 
                DECLARE
                    r RECORD;
                BEGIN
                    FOR r IN (SELECT DISTINCT constraint_name, table_name 
                            FROM information_schema.constraint_column_usage 
                            WHERE table_schema = 'public') 
                    LOOP
                        EXECUTE 'ALTER TABLE IF EXISTS ' || quote_ident(r.table_name) || 
                                ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE;';
                    END LOOP;
                END $$;
            `);

            // 3. Atualizar a tabela users para UUID
            await queryInterface.sequelize.query(`
                ALTER TABLE users 
                ALTER COLUMN id DROP DEFAULT,
                ALTER COLUMN id TYPE UUID USING (uuid_generate_v4()),
                ALTER COLUMN id SET DEFAULT uuid_generate_v4();
            `);

            // 4. Atualizar a tabela roles para UUID
            await queryInterface.sequelize.query(`
                ALTER TABLE roles 
                ALTER COLUMN id DROP DEFAULT,
                ALTER COLUMN id TYPE UUID USING (uuid_generate_v4()),
                ALTER COLUMN id SET DEFAULT uuid_generate_v4();
            `);

            // 5. Criar/Atualizar tabela user_roles
            if (!(await queryInterface.tableExists('user_roles'))) {
                await queryInterface.createTable('user_roles', {
                    user_id: {
                        type: Sequelize.UUID,
                        references: { model: 'users', key: 'id' },
                        onDelete: 'CASCADE'
                    },
                    role_id: {
                        type: Sequelize.UUID,
                        references: { model: 'roles', key: 'id' },
                        onDelete: 'CASCADE'
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
            } else {
                await queryInterface.sequelize.query(`
                    ALTER TABLE user_roles
                    ALTER COLUMN user_id TYPE UUID USING (uuid_generate_v4()),
                    ALTER COLUMN role_id TYPE UUID USING (uuid_generate_v4());
                `);
            }

            // 6. Atualizar a tabela learning_modules para UUID
            await queryInterface.sequelize.query(`
                ALTER TABLE learning_modules 
                ALTER COLUMN id DROP DEFAULT,
                ALTER COLUMN id TYPE UUID USING (uuid_generate_v4()),
                ALTER COLUMN id SET DEFAULT uuid_generate_v4();
            `);

            // 7. Atualizar a tabela services
            await queryInterface.sequelize.query(`
                ALTER TABLE services
                ALTER COLUMN assigned_to TYPE UUID USING (uuid_generate_v4()),
                ALTER COLUMN created_by TYPE UUID USING (uuid_generate_v4());
            `);

            // 8. Atualizar a tabela user_progress
            await queryInterface.sequelize.query(`
                ALTER TABLE user_progress
                ALTER COLUMN user_id TYPE UUID USING (uuid_generate_v4()),
                ALTER COLUMN module_id TYPE UUID USING (uuid_generate_v4());
            `);

            // 9. Recriar todas as foreign keys
            await queryInterface.sequelize.query(`
                -- User Roles
                ALTER TABLE user_roles 
                ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;

                -- Services
                ALTER TABLE services
                ADD CONSTRAINT services_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
                ADD CONSTRAINT services_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

                -- User Progress
                ALTER TABLE user_progress
                ADD CONSTRAINT user_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                ADD CONSTRAINT user_progress_module_id_fkey FOREIGN KEY (module_id) REFERENCES learning_modules(id) ON DELETE CASCADE;
            `);

        } catch (error) {
            console.error('Erro na migração:', error);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        try {
            // Remover todas as foreign keys
            await queryInterface.sequelize.query(`
                DO $$ 
                DECLARE
                    r RECORD;
                BEGIN
                    FOR r IN (SELECT DISTINCT constraint_name, table_name 
                            FROM information_schema.constraint_column_usage 
                            WHERE table_schema = 'public') 
                    LOOP
                        EXECUTE 'ALTER TABLE IF EXISTS ' || quote_ident(r.table_name) || 
                                ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE;';
                    END LOOP;
                END $$;
            `);

            // Reverter todas as colunas para INTEGER
            await queryInterface.sequelize.query(`
                ALTER TABLE users ALTER COLUMN id TYPE INTEGER USING (1);
                ALTER TABLE roles ALTER COLUMN id TYPE INTEGER USING (1);
                ALTER TABLE user_roles 
                    ALTER COLUMN user_id TYPE INTEGER USING (1),
                    ALTER COLUMN role_id TYPE INTEGER USING (1);
                ALTER TABLE services 
                    ALTER COLUMN assigned_to TYPE INTEGER USING (1),
                    ALTER COLUMN created_by TYPE INTEGER USING (1);
                ALTER TABLE user_progress 
                    ALTER COLUMN user_id TYPE INTEGER USING (1),
                    ALTER COLUMN module_id TYPE INTEGER USING (1);
            `);

        } catch (error) {
            console.error('Erro no rollback:', error);
            throw error;
        }
    }
}; 