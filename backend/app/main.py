# ── Librería estándar ─────────────────────────────────────────────────────────
import logging

logging.basicConfig(level=logging.INFO)

# ── Terceros ──────────────────────────────────────────────────────────────────
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text

# ── Local ─────────────────────────────────────────────────────────────────────
from app.database.db import Base, engine
from app.routers.user_router import router as user_router
from app.routers.schedule_router import router as schedule_router
from app.routers.session_router import router as session_router
from app.routers.booking_router import router as booking_router
from app.routers.auth_router import router as auth_router
from app.routers.center_rules_router import router as center_rules_router

# ── Configuración de la aplicación ────────────────────────────────────────────
from fastapi.openapi.models import APIKey, APIKeyIn, SecuritySchemeType
from fastapi.security import HTTPBearer


# Esquema de seguridad para OpenAPI (Swagger UI) - solo documentación
from fastapi.openapi.utils import get_openapi

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

app = FastAPI(
    title="Alesport API",
    openapi_tags=[
        {"name": "auth", "description": "Autenticación y usuarios"},
        {"name": "users", "description": "Gestión de usuarios"},
        {"name": "sessions", "description": "Gestión de sesiones"},
        {"name": "bookings", "description": "Reservas de sesiones"},
        {"name": "schedule", "description": "Horarios semanales"},
        {"name": "settings", "description": "Configuración compartida de la app"},
    ],
    swagger_ui_parameters={"persistAuthorization": True},
)


# Personalizar el esquema OpenAPI para que Swagger UI muestre el botón Authorize
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version="1.0.0",
        description="API de Alesport con JWT auth",
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "OAuth2PasswordBearer": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }
    # Por defecto, no forzamos seguridad global
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi
logger = logging.getLogger(__name__)
logger.info("Alesport backend iniciado correctamente")

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
app.include_router(user_router, prefix="/api")
app.include_router(schedule_router, prefix="/api")
app.include_router(session_router, prefix="/api")
app.include_router(booking_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(center_rules_router, prefix="/api")

# Crea tablas nuevas que falten (por ejemplo, configuración compartida) sin tocar las existentes.
Base.metadata.create_all(bind=engine)


# ── Endpoints de sistema ──────────────────────────────────────────────────────
@app.get("/api")
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
