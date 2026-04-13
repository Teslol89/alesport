-- Add monthly booking quota for client plans (8/12/unlimited)
-- Safe to run once in existing databases.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS monthly_booking_quota INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_monthly_booking_quota_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_monthly_booking_quota_check
      CHECK (monthly_booking_quota IS NULL OR monthly_booking_quota BETWEEN 1 AND 60);
  END IF;
END $$;

COMMIT;
