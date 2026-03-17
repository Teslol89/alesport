-- 002_add_capacity_max_constraint.sql
-- Adds a CHECK constraint to weekly_schedule to enforce capacity <= 10.
-- The API already validates this, but the constraint ensures consistency
-- for any insert that bypasses the API layer.
--
-- Also clamps any pre-existing rows that exceed the limit (data fix).

BEGIN;

-- Fix existing rows that violate the new constraint (test data created before API validation was in place).
UPDATE weekly_schedule
SET capacity = 10
WHERE capacity > 10;

ALTER TABLE weekly_schedule
    ADD CONSTRAINT chk_capacity_max
    CHECK (capacity <= 10);

COMMIT;
