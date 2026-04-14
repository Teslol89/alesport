from datetime import datetime

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import Integer, String, Text, TIMESTAMP

from app.database.db import Base


class SessionModel(Base):
    """Mapeo ORM de la tabla 'sessions'.
    Representa una clase concreta con fecha y hora reales,
    generada a partir de 'weekly_schedule'.
    Es el objeto sobre el que los clientes realizan sus reservas (bookings).
    """

    __tablename__ = "sessions"

    # Identificador único de la sesión
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # Entrenador que imparte la sesión
    # ON DELETE RESTRICT: no se puede eliminar un entrenador que tenga sesiones
    trainer_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    # Plantilla semanal de origen (si la sesión fue generada automáticamente)
    weekly_schedule_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("weekly_schedule.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Fecha y hora de inicio de la sesión (con zona horaria)
    start_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    # Fecha y hora de fin de la sesión (con zona horaria)
    end_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    # Número máximo de asistentes (1-10)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    # Nombre visible de la clase (ej. Funcional, Spinning)
    class_name: Mapped[str] = mapped_column(String(120), nullable=False, default="Clase")
    # Notas opcionales para detalles operativos de la sesión
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Estado actual: 'active', 'cancelled' o 'completed'
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    # Fecha de creación, generada automáticamente por la base de datos
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)