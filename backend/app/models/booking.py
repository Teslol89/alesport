from datetime import datetime

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import Integer, String, TIMESTAMP

from app.database.db import Base


class Booking(Base):
    """Mapeo ORM de la tabla 'bookings'.
    Representa la reserva de un cliente en una sesión concreta.
    """

    __tablename__ = "bookings"

    # Identificador único de la reserva
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # Cliente que realiza la reserva
    # ON DELETE CASCADE: si se elimina el usuario, se eliminan sus reservas
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Sesión que se está reservando
    # ON DELETE CASCADE: si se elimina la sesión, se eliminan sus reservas
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    # Estado de la reserva: 'active' o 'cancelled'
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    # Fecha de creación, generada automáticamente por la base de datos
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
