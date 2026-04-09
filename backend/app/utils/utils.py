import logging
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo


LOCAL_TIMEZONE = ZoneInfo("Europe/Madrid")


def to_local_datetime(value: datetime) -> datetime:
    """Normaliza un datetime a la zona horaria local de la aplicación.

    Las fechas que llegan sin tzinfo desde la BD se interpretan como UTC,
    porque las sesiones se almacenan normalizadas en ese huso.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).astimezone(LOCAL_TIMEZONE)
    return value.astimezone(LOCAL_TIMEZONE)


def is_past_session_datetime(value: datetime) -> bool:
    """Indica si una sesión pertenece a un día anterior al actual en horario local."""
    return to_local_datetime(value).date() < datetime.now(LOCAL_TIMEZONE).date()

def get_logger(name: Optional[str] = None) -> logging.Logger:
    """Devuelve un logger configurado con el nombre dado o root."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter('[%(asctime)s] %(levelname)s %(name)s: %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)
    return logger
