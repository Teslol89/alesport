-- Desarrollado por J.Marcos C.V. aka Teslol

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'client',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SESSION TYPES
CREATE TABLE IF NOT EXISTS session_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    capacity INTEGER NOT NULL CHECK (capacity > 0)
);

-- SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_type_id INTEGER NOT NULL REFERENCES session_types(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- BOOKINGS
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CLIENT PACKAGES
CREATE TABLE IF NOT EXISTS client_packages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total_classes INTEGER NOT NULL CHECK (total_classes > 0),
    remaining_classes INTEGER NOT NULL CHECK (remaining_classes >= 0),
    valid_until DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES

CREATE INDEX IF NOT EXISTS idx_sessions_start_time
ON sessions(start_time);

CREATE INDEX IF NOT EXISTS idx_bookings_session
ON bookings(session_id);

CREATE INDEX IF NOT EXISTS idx_bookings_user
ON bookings(user_id);

-- PREVENT DOUBLE BOOKING
CREATE UNIQUE INDEX IF NOT EXISTS unique_booking
ON bookings(user_id, session_id);