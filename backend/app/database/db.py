import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Carga el .env desde la raíz del proyecto, independientemente del directorio de trabajo
env_path = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL is None:
    raise RuntimeError("DATABASE_URL no está definida en el archivo .env")

# Forzar el uso de psycopg (v3) en lugar de psycopg2
SQLALCHEMY_DATABASE_URL = DATABASE_URL.replace(
    "postgresql://", "postgresql+psycopg://", 1
)

# pool_pre_ping=True: verifica la conexión antes de usarla para evitar errores por conexiones caídas.
engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)

# Fábrica de sesiones: autocommit y autoflush desactivados para control manual de transacciones
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Clase base para todos los modelos ORM
Base = declarative_base()


def get_db():
    """Generador de sesiones de BD para inyección de dependencias en FastAPI.
    Garantiza que la sesión se cierra siempre, incluso si ocurre una excepción.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
