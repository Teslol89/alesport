-- Ensure sessions capacity follows 1..10 range in existing databases.
DO $$
DECLARE
    con RECORD;
BEGIN
    FOR con IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'sessions'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%capacity%'
    LOOP
        EXECUTE format('ALTER TABLE sessions DROP CONSTRAINT %I', con.conname);
    END LOOP;

    ALTER TABLE sessions
        ADD CONSTRAINT sessions_capacity_range
        CHECK (capacity > 0 AND capacity <= 10);
END $$;
