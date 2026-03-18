from datetime import date, datetime, time

from pydantic import BaseModel, Field, model_validator


class WeeklyScheduleResponse(BaseModel):
    """Datos del horario semanal devueltos al cliente."""

    id: int
    trainer_id: int
    day_of_week: int  # 0=lunes, 1=martes, ..., 6=domingo
    start_time: time
    end_time: time
    capacity: int
    is_active: bool
    created_at: datetime

    # Permite a Pydantic leer datos directamente desde objetos ORM de SQLAlchemy
    model_config = {"from_attributes": True}


class WeeklyScheduleCreate(BaseModel):
    """Datos necesarios para crear un nuevo horario semanal.
    Al crearlo se generan automáticamente sesiones concretas
    para las próximas 'weeks_ahead' semanas.
    """

    trainer_id: int = Field(gt=0)
    day_of_week: int = Field(ge=0, le=6)  # 0=lunes, 6=domingo
    start_time: time
    end_time: time
    capacity: int = Field(gt=0, le=10)
    # Número de semanas futuras para las que se generan sesiones automáticamente
    weeks_ahead: int = Field(default=4, ge=1, le=12)

    @model_validator(mode="after")
    def validate_times(self):
        # Las horas deben ser en punto (:00) o media hora (:30), sin segundos
        for field_name, t in (("start_time", self.start_time), ("end_time", self.end_time)):
            if t.second != 0 or t.minute not in (0, 30):
                raise ValueError(
                    f"{field_name} debe estar en punto o media hora (ej: 18:00 o 18:30)"
                )
        if self.start_time >= self.end_time:
            raise ValueError("start_time debe ser anterior a end_time")
        return self


class SessionGenerationRequest(BaseModel):
    """Parámetros para generar sesiones manualmente desde los horarios activos."""

    # Número de semanas futuras a generar (por defecto 8, máximo 12)
    weeks_ahead: int = Field(default=8, ge=1, le=12)
    # Fecha de inicio de la ventana (por defecto hoy)
    start_date: date | None = None


class SessionGenerationResponse(BaseModel):
    """Resumen del resultado de la generación de sesiones."""

    weeks_ahead: int
    window_start: date
    window_end: date
    # Total de franjas horarias analizadas en la ventana temporal
    total_slots_considered: int
    # Sesiones nuevas creadas en esta ejecución
    generated_count: int
    # Sesiones omitidas porque ya existían (garantiza idempotencia)
    skipped_existing_count: int
