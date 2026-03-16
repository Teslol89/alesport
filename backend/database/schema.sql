-- =========================================
-- Alesport Database Schema
-- Author: J.Marcos C.V. aka Teslol
-- =========================================


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

    is_active BOOLEAN DEFAULT TRUE,

    last_login TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- INDEX FOR LOGIN
CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);



-- ===============================
-- SESSION TYPES
-- ===============================

CREATE TABLE IF NOT EXISTS session_types (

    id SERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    description VARCHAR(255),

    capacity INTEGER NOT NULL
        CHECK (capacity > 0)
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

    capacity INTEGER NOT NULL
        CHECK (capacity > 0),

    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','cancelled','completed')),

    created_by INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- ensure logical time range
    CHECK (end_time > start_time)
);


-- INDEXES FOR SESSION SEARCH
CREATE INDEX IF NOT EXISTS idx_sessions_start_time
ON sessions(start_time);


CREATE INDEX IF NOT EXISTS idx_sessions_type
ON sessions(session_type_id);


-- Prevent duplicated sessions created by same trainer at same time
CREATE UNIQUE INDEX IF NOT EXISTS unique_session_time
ON sessions(start_time, end_time, created_by);



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
        CHECK (status IN ('active','cancelled','completed')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- INDEXES
CREATE INDEX IF NOT EXISTS idx_bookings_session
ON bookings(session_id);


CREATE INDEX IF NOT EXISTS idx_bookings_user
ON bookings(user_id);


-- Prevent same user booking same session twice
CREATE UNIQUE INDEX IF NOT EXISTS unique_booking
ON bookings(user_id, session_id);



-- ===============================
-- CLIENT PACKAGES
-- ===============================

CREATE TABLE IF NOT EXISTS client_packages (

    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    total_classes INTEGER NOT NULL
        CHECK (total_classes > 0),

    remaining_classes INTEGER NOT NULL
        CHECK (remaining_classes >= 0),

    valid_until DATE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- INDEX FOR CLIENT PACKAGE LOOKUP
CREATE INDEX IF NOT EXISTS idx_packages_user
ON client_packages(user_id);