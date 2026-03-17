from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
import logging
from app.database.db import engine

app = FastAPI(title="Alesport API")
logger = logging.getLogger(__name__)

# Configure CORS to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Alesport backend running"}


@app.get("/db-test")
def test_database_connection():
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
