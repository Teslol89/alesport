import os
from datetime import datetime, timedelta, time
from sqlalchemy import create_engine, text
from passlib.context import CryptContext

# Configuración de conexión: usar la BD indicada por entorno para no tocar servidores remotos por accidente.
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise RuntimeError("DATABASE_URL no está configurada")

if DB_URL.startswith("postgresql://") and "+psycopg" not in DB_URL:
    DB_URL = DB_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(DB_URL)

# Hasher bcrypt
pwd_context = CryptContext(schemes=["bcrypt"])

# Función auxiliar para hashear contraseñas
def hash_pwd(pwd):
    return pwd_context.hash(pwd)

USERS = [
    {
        "name": "SuperAdmin",
        "email": "verdeguerlabs@verdeguerlabs.es",
        "password": os.getenv("SUPERADMIN_PASSWORD", "Verdeguer89**"),
        "role": "superadmin",
    },
    {"name": "Trainer", "email": "trainer@demo.com", "password": "trainer123", "role": "trainer"},
    {"name": "Cliente", "email": "cliente@demo.com", "password": "cliente123", "role": "client"},
]

with engine.begin() as conn:
    # Eliminar datos
    conn.execute(text("DELETE FROM bookings"))
    conn.execute(text("DELETE FROM sessions"))
    conn.execute(text("DELETE FROM weekly_schedule"))
    conn.execute(text("DELETE FROM users"))
    # Insertar usuarios
    user_ids = {}
    for u in USERS:
        res = conn.execute(
            text("""
            INSERT INTO users (name, email, password_hash, role, is_active, membership_active, is_verified, verification_code)
            VALUES (:name, :email, :password_hash, :role, true, true, true, NULL)
            RETURNING id
            """),
            dict(name=u["name"], email=u["email"], password_hash=hash_pwd(u["password"]), role=u["role"])
        )
        user_ids[u["role"]] = res.scalar()

    # Insertar horario semanal para el trainer
    trainer_id = user_ids["trainer"]
    day_of_week = datetime.now().weekday()  # hoy
    start = time(10, 0)
    end = time(11, 0)
    res = conn.execute(
        text("""
        INSERT INTO weekly_schedule (trainer_id, day_of_week, start_time, end_time, capacity, is_active)
        VALUES (:trainer_id, :day_of_week, :start_time, :end_time, :capacity, true)
        RETURNING id
        """),
        dict(trainer_id=trainer_id, day_of_week=day_of_week, start_time=start, end_time=end, capacity=5)
    )
    schedule_id = res.scalar()

    # Insertar 3 sesiones para ese horario (hoy, mañana, pasado)
    session_ids = []
    for i in range(3):
        session_date = datetime.now().date() + timedelta(days=i)
        session_start = datetime.combine(session_date, start)
        session_end = datetime.combine(session_date, end)
        res = conn.execute(
            text("""
            INSERT INTO sessions (trainer_id, start_time, end_time, capacity, class_name, notes, status)
            VALUES (:trainer_id, :start_time, :end_time, :capacity, :class_name, :notes, 'active')
            RETURNING id
            """),
            dict(
                trainer_id=trainer_id,
                start_time=session_start,
                end_time=session_end,
                capacity=5,
                class_name=f"Clase demo {i + 1}",
                notes="Sesión generada por seed local",
            )
        )
        session_ids.append(res.scalar())

    # Insertar una reserva para el cliente en la primera sesión
    client_id = user_ids["client"]
    conn.execute(
        text("""
        INSERT INTO bookings (user_id, session_id, status)
        VALUES (:user_id, :session_id, 'active')
        """),
        dict(user_id=client_id, session_id=session_ids[0])
    )

print("Usuarios, horarios, sesiones y reserva de ejemplo insertados correctamente.")
