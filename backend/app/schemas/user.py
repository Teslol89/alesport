from pydantic import BaseModel, EmailStr, Field


# --- SCHEMA PARA REGISTRO DE USUARIO ---
class UserCreate(BaseModel):
    """Datos necesarios para registrar un nuevo usuario.
    El campo 'role' se asigna automáticamente a 'client'
    en el servicio de creación."""

    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


# --- SCHEMA PARA RESPUESTA DE USUARIO ---
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
