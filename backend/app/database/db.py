
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

DATABASE_URL = settings.DATABASE_URL

if DATABASE_URL is None:
    raise RuntimeError("DATABASE_URL no está definida en el archivo .env")

# Forzar el uso de psycopg (v3) en lugar de psycopg2
SQLALCHEMY_DATABASE_URL = DATABASE_URL.replace(
    "postgresql://", "postgresql+psycopg://", 1
)

# pool_pre_ping=True: verifica la conexión antes de usarla para evitar errores por conexiones caídas.
# pool_size=20, max_overflow=20: soporta hasta 40 conexiones simultáneas para cargas con muchas peticiones paralelas.
# pool_recycle=1800: recicla conexiones cada 30 min para evitar conexiones caídas por timeout del servidor.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=20,
    pool_recycle=1800,
)

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
