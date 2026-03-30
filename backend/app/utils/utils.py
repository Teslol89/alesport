import logging
from typing import Optional

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
