from pydantic import BaseModel, EmailStr, Field
from typing import Optional


# --- SCHEMA PARA REGISTRO DE USUARIO ---
class UserCreate(BaseModel):
    """Datos necesarios para registrar un nuevo usuario.
    El campo 'role' se asigna automáticamente a 'client'
    en el servicio de creación."""

    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    phone: Optional[str] = Field(None, max_length=20)


# --- SCHEMA PARA ACTUALIZAR PERFIL PROPIO ---
class UserProfileUpdate(BaseModel):
    """Campos que el propio usuario puede actualizar desde su perfil.
    Todos son opcionales: solo se actualizan los que se envíen."""

    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)


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
    phone: Optional[str] = None

    # Permite a Pydantic leer datos directamente desde objetos ORM de SQLAlchemy
    model_config = {"from_attributes": True}
