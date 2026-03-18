from pydantic import BaseModel


class UserResponse(BaseModel):
    """Datos del usuario devueltos al cliente.

    Los campos sensibles (password_hash, last_login, etc.) se excluyen
    intencionalmente para no exponerlos en la API.
    """

    id: int
    name: str
    email: str
    role: str
    is_active: bool
    membership_active: bool

    # Permite a Pydantic leer datos directamente desde objetos ORM de SQLAlchemy
    model_config = {"from_attributes": True}
