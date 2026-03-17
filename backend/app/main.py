# ── Standard library ─────────────────────────────────────────────────────────
import logging

# ── Third-party ───────────────────────────────────────────────────────────────
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

# ── Local ─────────────────────────────────────────────────────────────────────
from app.database.db import engine
from app.routers.user_router import router as user_router

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(title="Alesport API")
logger = logging.getLogger(__name__)

# ── Middleware ────────────────────────────────────────────────────────────────
# Must be registered before routers so it intercepts every request.
# In production, replace "*" with the exact frontend origin.

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(user_router)

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    """Health check."""
    return {"message": "Alesport backend running"}


# TODO: remove or protect this endpoint before going to production.
@app.get("/db-test")
def test_database_connection():
    """Verifies that the app can reach the database."""
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
