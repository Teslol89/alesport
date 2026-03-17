-- 002_legacy_cleanup.sql
-- Purpose: Align older databases with current booking index strategy.
-- Safe to run multiple times.

BEGIN;

-- Remove legacy unique index that blocks re-booking after cancellation.
DROP INDEX IF EXISTS unique_booking;

-- Ensure partial unique index exists: one active booking per user/session.
CREATE UNIQUE INDEX IF NOT EXISTS unique_booking_active
ON bookings(user_id, session_id)
WHERE status = 'active';

-- Optional performance index for active booking lookups.
CREATE INDEX IF NOT EXISTS idx_bookings_active_session
ON bookings(session_id)
WHERE status = 'active';

COMMIT;
