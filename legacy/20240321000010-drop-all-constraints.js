'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            // 1. Remover todas as foreign keys e constraints
            await queryInterface.sequelize.query(`
                DO $$ 
                DECLARE
                    r RECORD;
                BEGIN
                    -- Desabilitar triggers
                    SET session_replication_role = 'replica';

                    -- Dropar todas as foreign keys
                    FOR r IN (
                        SELECT DISTINCT tc.table_name, tc.constraint_name
                        FROM information_schema.table_constraints tc
                        WHERE tc.constraint_type = 'FOREIGN KEY'
                        AND tc.table_schema = 'public'
                    ) LOOP
                        EXECUTE 'ALTER TABLE ' || quote_ident(r.table_name) || 
                                ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
                    END LOOP;

                    -- Dropar todos os triggers
                    FOR r IN (
                        SELECT DISTINCT trigger_name, event_object_table
                        FROM information_schema.triggers
                        WHERE trigger_schema = 'public'
                    ) LOOP
                        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || 
                                ' ON ' || quote_ident(r.event_object_table) || ' CASCADE';
                    END LOOP;

                    -- Dropar todos os índices (exceto primary keys)
                    FOR r IN (
                        SELECT schemaname, tablename, indexname 
                        FROM pg_indexes 
                        WHERE schemaname = 'public' 
                        AND indexname NOT IN (
                            SELECT constraint_name 
                            FROM information_schema.table_constraints 
                            WHERE constraint_type = 'PRIMARY KEY'
                        )
                    ) LOOP
                        EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(r.schemaname) || '.' || 
                                quote_ident(r.indexname) || ' CASCADE';
                    END LOOP;

                    -- Reabilitar triggers
                    SET session_replication_role = 'origin';
                END $$;
            `);

            // 2. Remover tipos ENUM
            await queryInterface.sequelize.query(`
                DO $$ 
                DECLARE
                    r RECORD;
                BEGIN
                    FOR r IN (
                        SELECT t.typname
                        FROM pg_type t
                        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                        WHERE n.nspname = 'public'
                        AND t.typtype = 'e'
                    ) LOOP
                        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
                    END LOOP;
                END $$;
            `);

        } catch (error) {
            console.error('Erro ao remover constraints:', error);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        // Não precisamos fazer nada no down, pois as constraints serão recriadas
        // nas migrações subsequentes
    }
}; 