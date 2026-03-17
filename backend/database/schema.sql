-- =========================================
-- Alesport Database Schema (Simplified MVP)
-- =========================================

-- Required for EXCLUDE USING gist
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
        CHECK (role IN ('admin','trainer','client')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    membership_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ===============================
-- WEEKLY SCHEDULE
-- ===============================

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
    CHECK (end_time > start_time),
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

-- ===============================
-- SESSIONS
-- ===============================

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    trainer_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,

    capacity INTEGER NOT NULL CHECK (capacity > 0),

    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','cancelled','completed')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (end_time > start_time),

    -- Prevent overlapping sessions
    CONSTRAINT no_overlap_sessions
        EXCLUDE USING gist (
            trainer_id WITH =,
            tstzrange(start_time, end_time, '[)') WITH &&
        )
        WHERE (status = 'active')
);



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
        CHECK (status IN ('active','cancelled')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);



-- ===============================
-- INDEXES
-- ===============================

-- WEEKLY SCHEDULE
CREATE INDEX IF NOT EXISTS idx_schedule_trainer
ON weekly_schedule(trainer_id);

CREATE INDEX IF NOT EXISTS idx_schedule_day
ON weekly_schedule(day_of_week);


-- SESSIONS
CREATE INDEX IF NOT EXISTS idx_sessions_start_time
ON sessions(start_time);

CREATE INDEX IF NOT EXISTS idx_sessions_trainer
ON sessions(trainer_id);

CREATE INDEX IF NOT EXISTS idx_sessions_status
ON sessions(status);


-- BOOKINGS
CREATE INDEX IF NOT EXISTS idx_bookings_session
ON bookings(session_id);

CREATE INDEX IF NOT EXISTS idx_bookings_user
ON bookings(user_id);

CREATE INDEX IF NOT EXISTS idx_bookings_active_session
ON bookings(session_id)
WHERE status = 'active';


-- Prevent duplicate active bookings
CREATE UNIQUE INDEX IF NOT EXISTS unique_booking_active
ON bookings(user_id, session_id)
WHERE status = 'active';