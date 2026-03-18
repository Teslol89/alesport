# ── Librería estándar ─────────────────────────────────────────────────────────
import logging

# ── Terceros ──────────────────────────────────────────────────────────────────
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

# ── Local ─────────────────────────────────────────────────────────────────────
from app.database.db import engine
from app.routers.user_router import router as user_router
from app.routers.schedule_router import router as schedule_router
from app.routers.session_router import router as session_router

# ── Configuración de la aplicación ────────────────────────────────────────────
app = FastAPI(title="Alesport API")
logger = logging.getLogger(__name__)

# ── Middleware CORS ───────────────────────────────────────────────────────────
# Debe registrarse antes de los routers para interceptar todas las peticiones.
# En producción, reemplazar "*" por el origen exacto del frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(user_router)
app.include_router(schedule_router)
app.include_router(session_router)

# ── Endpoints de sistema ──────────────────────────────────────────────────────
@app.get("/")
def root():
    """Health check: verifica que la API esta en funcionamiento."""
    return {"message": "Alesport backend running"}


# TODO: eliminar o proteger este endpoint antes de pasar a producción.
@app.get("/db-test")
def test_database_connection():
    """Verifica que la API puede conectarse correctamente a la base de datos."""
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            return {"database_connection": "successful", "result": result.scalar()}
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return {
            "database_connection": "failed",
            "error": "Unable to connect to database",
        }
