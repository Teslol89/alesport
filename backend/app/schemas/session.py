# ------------------------------ #
# --- Esquemas para sesiones --- #
# ------------------------------ #
from datetime import date, datetime, time
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator
from app.utils.utils import LOCAL_TIMEZONE


# --- Esquemas relacionados con las sesiones concretas (no recurrentes) --- #
class SessionCreate(BaseModel):
    """Schema para crear una sesión puntual concreta.
    El trainer_id se obtiene del usuario autenticado (o se requiere para admins).
    """

    # Fecha de la sesión (YYYY-MM-DD)
    session_date: date
    # Hora de inicio (HH:MM)
    start_time: time
    # Hora de fin (HH:MM)
    end_time: time
    # Capacidad (1-10)
    capacity: int = Field(gt=0, le=10)
    # Nombre visible de la clase
    class_name: str = Field(min_length=1, max_length=120)
    # Notas opcionales
    notes: str | None = Field(default=None, max_length=1000)
    # Trainer ID (opcional: solo si lo asigna un admin)
    trainer_id: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_time_range(self):
        """Valida que start_time < end_time."""
        if self.start_time >= self.end_time:
            raise ValueError("start_time debe ser anterior a end_time")
        return self


# --- Esquema para crear sesiones recurrentes (transaccional) --- #
class SessionRecurringCreateList(BaseModel):
    """Lista de sesiones a crear de forma recurrente (transaccional)."""

    sessions: list[SessionCreate]


# --- Esquema para copiar el horario de una semana a otra --- #
class SessionCopyWeekRequest(BaseModel):
    """Datos necesarios para copiar sesiones de una semana a otra.
    El trainer_id se obtiene del usuario autenticado (o se requiere para admins)."""

    source_week_start_date: date
    target_week_start_date: date
    trainer_id: int | None = None  # Opcional, solo para admins


# --- Esquemas para respuestas y actualizaciones de sesiones concretas --- #
class SessionResponse(BaseModel):
    """Datos de una sesión concreta devueltos al cliente."""

    id: int
    trainer_id: int
    trainer_name: str
    start_datetime: datetime = Field(validation_alias="start_time", exclude=True)
    end_datetime: datetime = Field(validation_alias="end_time", exclude=True)
    capacity: int
    class_name: str
    notes: str | None = None
    status: str
    created_at: datetime

    # Permite a Pydantic leer datos directamente desde objetos ORM de SQLAlchemy
    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def session_date(self) -> date:
        """Fecha local de la sesión para consumo directo del cliente."""
        return self.start_datetime.astimezone(LOCAL_TIMEZONE).date()

    @computed_field
    @property
    def start_time(self) -> time:
        """Hora local de inicio sin offset, pensada para mostrar en móvil."""
        return (
            self.start_datetime.astimezone(LOCAL_TIMEZONE).timetz().replace(tzinfo=None)
        )

    @computed_field
    @property
    def end_time(self) -> time:
        """Hora local de fin sin offset, pensada para mostrar en móvil."""
        return (
            self.end_datetime.astimezone(LOCAL_TIMEZONE).timetz().replace(tzinfo=None)
        )


# --- Esquemas para actualizaciones de sesiones --- #
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
    # Nombre visible de la clase
    class_name: str | None = Field(default=None, min_length=1, max_length=120)
    # Notas internas opcionales
    notes: str | None = Field(default=None, max_length=1000)
    # Reasignación de entrenador (solo admin)
    trainer_id: int | None = Field(default=None, gt=0)
    # Nuevo estado de la sesión
    status: Literal["active", "cancelled", "completed"] | None = None


# --- Esquema para actualizaciones masivas de sesiones de una semana concreta --- #
class SessionWeekUpdate(BaseModel):
    """Actualización masiva de sesiones de una semana concreta para un entrenador.
    Los admins deben incluir trainer_id para indicar de qué entrenador modifican la semana.
    Los trainers no necesitan incluirlo; se usa su propio id del token.
    """

    week_start_date: date
    # Solo necesario cuando lo llama un admin
    trainer_id: int | None = Field(default=None, gt=0)
    start_time: time | None = None
    end_time: time | None = None
    capacity: int | None = Field(default=None, gt=0, le=10)
    class_name: str | None = Field(default=None, min_length=1, max_length=120)
    notes: str | None = Field(default=None, max_length=1000)
    status: Literal["active", "cancelled", "completed"] | None = None

    @model_validator(mode="after")
    def validate_at_least_one_field(self):
        """Exige al menos un campo de cambio (sin contar trainer_id/week_start_date)."""
        if (
            self.start_time is None
            and self.end_time is None
            and self.capacity is None
            and self.class_name is None
            and self.notes is None
            and self.status is None
        ):
            raise ValueError("Debes enviar al menos un campo para actualizar")
        return self
