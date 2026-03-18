from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SessionResponse(BaseModel):
    """Datos de una sesión concreta devueltos al cliente."""

    id: int
    trainer_id: int
    start_time: datetime
    end_time: datetime
    capacity: int
    status: str
    created_at: datetime

    # Permite a Pydantic leer datos directamente desde objetos ORM de SQLAlchemy
    model_config = {"from_attributes": True}


class SessionUpdate(BaseModel):
    """Campos que el entrenador puede ajustar manualmente en una sesion.
    Todos los campos son opcionales: solo se envían los que se quieren cambiar (PATCH parcial).
    """

    # Nueva hora de inicio (opcional)
    start_time: datetime | None = None
    # Nueva hora de fin (opcional)
    end_time: datetime | None = None
    # Capacidad ajustada -- debe mantenerse entre 1 y 10
    capacity: int | None = Field(default=None, gt=0, le=10)
    # Nuevo estado de la sesion
    status: Literal["active", "cancelled", "completed"] | None = None
