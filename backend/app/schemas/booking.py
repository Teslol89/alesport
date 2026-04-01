from datetime import datetime

from pydantic import BaseModel, Field


class BookingCreate(BaseModel):
    """Datos necesarios para crear una nueva reserva.
    El cliente solo necesita indicar la sesión que quiere reservar.
    El user_id se obtendrá del token de autenticación (cuando se implemente JWT).
    """

    # ID de la sesión que se quiere reservar
    session_id: int = Field(gt=0)


class BookingResponse(BaseModel):
    """Datos de una reserva devueltos al cliente."""

    id: int
    user_id: int
    session_id: int
    # Estado de la reserva: 'active' o 'cancelled'
    status: str
    created_at: datetime
    user_name: str | None = None
    user_email: str | None = None

    # Permite a Pydantic leer datos directamente desde objetos ORM de SQLAlchemy
    model_config = {"from_attributes": True}
