from datetime import datetime, time

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import Boolean, Integer, String, Text, Time, TIMESTAMP

from app.database.db import Base


class WeeklySchedule(Base):
    """Mapeo ORM de la tabla 'weekly_schedule'.
    Representa la plantilla de horarios semanales recurrentes de un entrenador.
    A partir de esta plantilla el sistema genera las sesiones concretas (tabla 'sessions').
    """

    __tablename__ = "weekly_schedule"

    # Identificador único del horario
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # Entrenador al que pertenece este horario
    trainer_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    # Día de la semana: 0=lunes, 1=martes, ..., 6=domingo
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    # Hora de inicio del bloque (debe ser en punto o media hora: :00 o :30)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    # Hora de fin del bloque (debe ser en punto o media hora: :00 o :30)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    # Número máximo de asistentes por sesión (1-10)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    # Nombre base de clase para las sesiones que se generen desde esta plantilla
    class_name: Mapped[str] = mapped_column(String(120), nullable=False, default="Clase")
    # Notas opcionales que se propagan a sesiones generadas
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Indica si este horario está activo y debe generar sesiones futuras
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Fecha de creación, generada automáticamente por la base de datos
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), nullable=False)
