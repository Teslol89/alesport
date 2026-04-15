"""
seed_test_users.py — Crea usuarios de prueba en la BD local SIN borrar datos existentes.

Uso:
    cd backend
    venv\\Scripts\\activate
    python seed_test_users.py

Solo añade los usuarios si no existen ya. Seguro de ejecutar múltiples veces.
NO ejecutar en producción — solo para entorno local de desarrollo.
"""
import os
import sys
from sqlalchemy import create_engine, text
from passlib.context import CryptContext

DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    # Intentar cargar el .env desde la raíz del proyecto
    from pathlib import Path
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        DB_URL = os.getenv("DATABASE_URL")

if not DB_URL:
    print("ERROR: DATABASE_URL no está configurada. Crea el .env en la raíz del proyecto.")
    sys.exit(1)

# Bloqueo de seguridad: no ejecutar contra producción
if "verdeguerlabs.es" in DB_URL or "api.verdeguerlabs" in DB_URL:
    print("ERROR: Parece que DATABASE_URL apunta a producción. Abortando.")
    sys.exit(1)

if DB_URL.startswith("postgresql://") and "+psycopg" not in DB_URL:
    DB_URL = DB_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(DB_URL)
pwd_context = CryptContext(schemes=["bcrypt"])

TEST_USERS = [
    {
        "name": "Trainer Demo",
        "email": "trainer@demo.com",
        "password": "trainer123",
        "role": "trainer",
        "is_active": True,
        "membership_active": True,
    },
    {
        "name": "Cliente Demo",
        "email": "cliente@demo.com",
        "password": "cliente123",
        "role": "client",
        "is_active": True,
        "membership_active": True,
    },
    {
        "name": "Cliente Sin Membresia",
        "email": "cliente.sinmembresia@demo.com",
        "password": "cliente123",
        "role": "client",
        "is_active": True,
        "membership_active": False,
    },
    {
        "name": "Cliente Inactivo",
        "email": "cliente.inactivo@demo.com",
        "password": "cliente123",
        "role": "client",
        "is_active": False,
        "membership_active": False,
    },
]

with engine.begin() as conn:
    created = 0
    skipped = 0
    for u in TEST_USERS:
        existing = conn.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": u["email"]}
        ).fetchone()

        if existing:
            print(f"  [SKIP] Ya existe: {u['email']}")
            skipped += 1
        else:
            conn.execute(
                text("""
                    INSERT INTO users (name, email, password_hash, role, is_active, membership_active, is_verified, verification_code)
                    VALUES (:name, :email, :password_hash, :role, :is_active, :membership_active, true, NULL)
                """),
                {
                    "name": u["name"],
                    "email": u["email"],
                    "password_hash": pwd_context.hash(u["password"]),
                    "role": u["role"],
                    "is_active": u["is_active"],
                    "membership_active": u["membership_active"],
                }
            )
            print(f"  [OK] Creado: {u['email']} ({u['role']})")
            created += 1

print(f"\nResumen: {created} creados, {skipped} ya existían.")
print("\nCredenciales de prueba:")
print("  trainer@demo.com         / trainer123  (trainer)")
print("  cliente@demo.com         / cliente123  (client, activo)")
print("  cliente.sinmembresia@demo.com / cliente123  (client, sin membresía)")
print("  cliente.inactivo@demo.com     / cliente123  (client, inactivo)")
