from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import os
from pathlib import Path
from dotenv import load_dotenv


# Calcula la ruta absoluta al .env (raíz del proyecto)

# Carga robusta del .env desde la raíz del proyecto (alesport)
project_root = Path(__file__).resolve().parents[2]
env_path = project_root / ".env"
if not env_path.exists():
    raise FileNotFoundError(f"No se encontró el archivo .env en: {env_path}")
load_dotenv(env_path)

if "DATABASE_URL" not in os.environ:
    raise EnvironmentError(f"DATABASE_URL no está en las variables de entorno tras cargar .env. Ruta buscada: {env_path}")


class Settings:
    def __init__(self):
        self.DATABASE_URL = os.environ["DATABASE_URL"]
        self.SECRET_KEY = os.environ["JWT_SECRET_KEY"]
        self.ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
        self.ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", 60))
        # SMTP config
        self.SMTP_HOST = os.environ.get("SMTP_HOST")
        self.SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
        self.SMTP_USER = os.environ.get("SMTP_USER")
        self.SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
        self.SMTP_FROM = os.environ.get("SMTP_FROM")
        # Frontend URL base para enlaces de verificación
        self.FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://www.verdeguerlabs.es")


settings = Settings()
