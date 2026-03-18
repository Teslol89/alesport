from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import Boolean, Integer, String, TIMESTAMP

from app.database.db import Base


class User(Base):
    """Mapeo ORM de la tabla 'users'.
    Representa a cualquier persona registrada en la aplicación.
    El campo 'role' determina los permisos: 'admin', 'trainer' o 'client'.
    """

    __tablename__ = "users"

    # Identificador único del usuario
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # Nombre completo
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Email único — se usa como identificador de acceso
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    # Contraseña hasheada; nunca se almacena en texto plano
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    # Rol del usuario: 'admin', 'trainer' o 'client'
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="client")
    # Indica si la cuenta está activa (false = cuenta bloqueada)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Indica si la membresía está vigente (false = no puede reservar)
    membership_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Última vez que el usuario inició sesión; nulo si nunca ha entrado
    last_login: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    # Fecha de creación, generada automáticamente por la base de datos
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
