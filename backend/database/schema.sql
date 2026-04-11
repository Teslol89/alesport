-- =========================================
-- Alesport Database Schema
-- =========================================
-- This is the single source of truth for schema.
-- Migrations are consolidated here during development phase.
-- Apply this entire file for fresh database setup.

-- Required for EXCLUDE USING gist (overlap prevention)
CREATE EXTENSION IF NOT EXISTS btree_gist;


-- ===============================
-- USERS
-- ===============================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'client'
        CHECK (role IN ('superadmin','admin','trainer','client')),
    phone VARCHAR(20),
    avatar_url TEXT,
    fcm_token TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    membership_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_code VARCHAR(12),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);


-- ===============================
-- WEEKLY SCHEDULE
-- ===============================
-- Represents recurring weekly time slots that trainers offer.
-- Rules:
--   - capacity: 1-10 attendees per slot
--   - times: must be on hour (00) or half-hour (30) minutes
--   - no overlaps: same trainer cannot have two active slots at same time on same day

CREATE TABLE IF NOT EXISTS weekly_schedule (
    id SERIAL PRIMARY KEY,
    trainer_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL
        CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0 AND capacity <= 10),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Temporal rules
    CHECK (end_time > start_time),
    CHECK (EXTRACT(MINUTE FROM start_time) IN (0, 30) AND EXTRACT(SECOND FROM start_time) = 0),
    CHECK (EXTRACT(MINUTE FROM end_time)   IN (0, 30) AND EXTRACT(SECOND FROM end_time)   = 0),
    
    -- Prevent overlapping schedules per trainer and day
    CONSTRAINT no_overlap_schedule
        EXCLUDE USING gist (
            trainer_id WITH =,
            day_of_week WITH =,
            int4range(
                EXTRACT(EPOCH FROM start_time)::INTEGER,
                EXTRACT(EPOCH FROM end_time)::INTEGER,
                '[)'
            ) WITH &&
        )
        WHERE (is_active)
);

CREATE INDEX IF NOT EXISTS idx_schedule_trainer ON weekly_schedule(trainer_id);
CREATE INDEX IF NOT EXISTS idx_schedule_day ON weekly_schedule(day_of_week);
CREATE INDEX IF NOT EXISTS idx_schedule_active ON weekly_schedule(is_active);


-- ===============================
-- SESSIONS
-- ===============================
-- Concrete session instances (specific date/time), based on weekly_schedule.
-- Rules:
--   - capacity: 1-10 attendees per session
--   - no overlaps: same trainer cannot have two non-cancelled sessions overlapping
--   - status: can be active, cancelled, or completed

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    trainer_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0 AND capacity <= 10),
    class_name VARCHAR(120) NOT NULL DEFAULT 'Clase',
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','cancelled','completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Temporal rules
    CHECK (end_time > start_time),
    
    -- Prevent overlapping non-cancelled sessions per trainer
    CONSTRAINT no_overlap_sessions
        EXCLUDE USING gist (
            trainer_id WITH =,
            tstzrange(start_time, end_time, '[)') WITH &&
        )
        WHERE (status <> 'cancelled')
);

CREATE INDEX IF NOT EXISTS idx_sessions_trainer ON sessions(trainer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_active_trainer ON sessions(trainer_id, status);


-- ===============================
-- CENTER RULES
-- ===============================
-- Shared center rules visible to all authenticated users and editable by admins.

CREATE TABLE IF NOT EXISTS center_rules (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_center_rules_sort_order ON center_rules(sort_order);


-- ===============================
-- BOOKINGS
-- ===============================
-- Links users to sessions (reservations).
-- Rules:
--   - one user can only have one active booking per session
--   - status: can be active, cancelled, waitlist or offered
--   - offered keeps a free slot blocked for a short confirmation window
--   - cascade delete: if session is deleted, all its bookings are deleted

CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    session_id INTEGER NOT NULL
        REFERENCES sessions(id)
        ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','cancelled','waitlist','offered')),
    offer_expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Prevent duplicate active bookings (user can only reserve each session once)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_booking_active 
    ON bookings(user_id, session_id) 
    WHERE (status = 'active');

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_session ON bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_active ON bookings(user_id, status);