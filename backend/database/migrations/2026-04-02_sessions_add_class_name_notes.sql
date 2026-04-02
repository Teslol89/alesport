-- Add class metadata fields to sessions
-- Execute this migration once on existing databases.

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS class_name VARCHAR(120);

UPDATE sessions
SET class_name = 'Clase'
WHERE class_name IS NULL;

ALTER TABLE sessions
    ALTER COLUMN class_name SET DEFAULT 'Clase',
    ALTER COLUMN class_name SET NOT NULL;

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS notes TEXT;
