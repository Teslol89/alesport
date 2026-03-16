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
    capacity INTEGER NOT NULL
);

-- SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_type_id INTEGER REFERENCES session_types(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    capacity INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- BOOKINGS
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    session_id INTEGER REFERENCES sessions(id),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CLIENT PACKAGES
CREATE TABLE IF NOT EXISTS client_packages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    total_classes INTEGER NOT NULL,
    remaining_classes INTEGER NOT NULL,
    valid_until DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- UNIQUE BOOKING INDEX
CREATE UNIQUE INDEX IF NOT EXISTS unique_booking
ON bookings(user_id, session_id);