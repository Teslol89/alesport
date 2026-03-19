from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator


class SessionResponse(BaseModel):
    """Datos de una sesión concreta devueltos al cliente."""

    id: int
    trainer_id: int
    start_datetime: datetime = Field(validation_alias="start_time", exclude=True)
    end_datetime: datetime = Field(validation_alias="end_time", exclude=True)
    capacity: int
    status: str
    created_at: datetime

    # Permite a Pydantic leer datos directamente desde objetos ORM de SQLAlchemy
    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def session_date(self) -> date:
        """Fecha local de la sesión para consumo directo del cliente."""
        return self.start_datetime.date()

    @computed_field
    @property
    def start_time(self) -> time:
        """Hora local de inicio sin offset, pensada para mostrar en móvil."""
        return self.start_datetime.timetz().replace(tzinfo=None)

    @computed_field
    @property
    def end_time(self) -> time:
        """Hora local de fin sin offset, pensada para mostrar en móvil."""
        return self.end_datetime.timetz().replace(tzinfo=None)


class SessionUpdate(BaseModel):
    """Campos que el entrenador puede ajustar manualmente en una sesión.
    Todos los campos son opcionales: solo se envían los que se quieren cambiar (PATCH parcial).
    Para start_time/end_time, solo hay que enviar la hora (ej: "09:00" o "10:30").
    La fecha se conserva de la sesión actual.
    """

    # Nueva hora de inicio (opcional) - solo la hora sin fecha
    start_time: time | None = None
    # Nueva hora de fin (opcional) - solo la hora sin fecha
    end_time: time | None = None
    # Capacidad ajustada -- debe mantenerse entre 1 y 10
    capacity: int | None = Field(default=None, gt=0, le=10)
    # Nuevo estado de la sesión
    status: Literal["active", "cancelled", "completed"] | None = None


class SessionWeekUpdate(BaseModel):
    """Actualización masiva de sesiones de una semana concreta para un entrenador."""

    week_start_date: date
    start_time: time | None = None
    end_time: time | None = None
    capacity: int | None = Field(default=None, gt=0, le=10)
    status: Literal["active", "cancelled", "completed"] | None = None

    @model_validator(mode="after")
    def validate_at_least_one_field(self):
        """Exige al menos un campo de cambio para evitar PATCH vacíos."""
        if (
            self.start_time is None
            and self.end_time is None
            and self.capacity is None
            and self.status is None
        ):
            raise ValueError("Debes enviar al menos un campo para actualizar")
        return self
