-- =========================================
-- Alesport Database Schema (Base)
-- =========================================

-- Required for EXCLUDE USING gist with integer equality + time range overlap.
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
        CHECK (role IN ('admin', 'trainer', 'client')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    membership_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- SESSION TYPES
-- ===============================

CREATE TABLE IF NOT EXISTS session_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    capacity INTEGER NOT NULL CHECK (capacity > 0)
);

-- ===============================
-- SESSIONS
-- ===============================

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_type_id INTEGER NOT NULL
        REFERENCES session_types(id)
        ON DELETE RESTRICT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'cancelled', 'completed')),
    created_by INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_time > start_time),
    CONSTRAINT no_overlapping_active_sessions_per_creator
        EXCLUDE USING gist (
            created_by WITH =,
            tstzrange(start_time, end_time, '[)') WITH &&
        )
        WHERE (status = 'active')
);

CREATE INDEX IF NOT EXISTS idx_sessions_start_time
ON sessions(start_time);

CREATE INDEX IF NOT EXISTS idx_sessions_type
ON sessions(session_type_id);

CREATE INDEX IF NOT EXISTS idx_sessions_created_by
ON sessions(created_by);

CREATE INDEX IF NOT EXISTS idx_sessions_status
ON sessions(status);

-- ===============================
-- BOOKINGS
-- ===============================

CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    session_id INTEGER NOT NULL
        REFERENCES sessions(id)
        ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_session
ON bookings(session_id);

CREATE INDEX IF NOT EXISTS idx_bookings_user
ON bookings(user_id);

CREATE INDEX IF NOT EXISTS idx_bookings_active_session
ON bookings(session_id)
WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS unique_booking_active
ON bookings(user_id, session_id)
WHERE status = 'active';