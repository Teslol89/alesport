from datetime import datetime

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import Integer, String, TIMESTAMP

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
    # Fecha y hora de inicio de la sesión (con zona horaria)
    start_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    # Fecha y hora de fin de la sesión (con zona horaria)
    end_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    # Número máximo de asistentes (1-10)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    # Estado actual: 'active', 'cancelled' o 'completed'
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    # Fecha de creación, generada automáticamente por la base de datos
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)