import re
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

PHONE_REGEX = re.compile(r"^(?:\+34)?[6789]\d{8}$")


def normalize_phone(value: Optional[str]) -> Optional[str]:
    """Normaliza teléfonos españoles a formato legible y rechaza valores imposibles."""
    if value is None:
        return None

    raw_value = value.strip()
    if raw_value == "":
        return None

    digits = re.sub(r"\D", "", raw_value)

    if digits.startswith("34"):
        if len(digits) != 11:
            raise ValueError("El teléfono debe tener 9 dígitos válidos (opcional +34)")
        national_number = digits[2:]
        compact_number = f"+34{national_number}"
        formatted_number = f"+34 {national_number[:3]} {national_number[3:6]} {national_number[6:]}"
    else:
        if len(digits) != 9:
            raise ValueError("El teléfono debe tener 9 dígitos válidos (opcional +34)")
        compact_number = digits
        formatted_number = f"{digits[:3]} {digits[3:6]} {digits[6:]}"

    if not PHONE_REGEX.fullmatch(compact_number):
        raise ValueError("El teléfono debe tener 9 dígitos válidos (opcional +34)")

    return formatted_number


# --- SCHEMA PARA REGISTRO DE USUARIO ---
class UserCreate(BaseModel):
    """Datos necesarios para registrar un nuevo usuario.
    El campo 'role' se asigna automáticamente a 'client'
    en el servicio de creación."""

    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    phone: Optional[str] = Field(None, max_length=15)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: Optional[str]) -> Optional[str]:
        return normalize_phone(value)


# --- SCHEMA PARA ACTUALIZAR PERFIL PROPIO ---
class UserProfileUpdate(BaseModel):
    """Campos que el propio usuario puede actualizar desde su perfil.
    Todos son opcionales: solo se actualizan los que se envíen."""

    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=15)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: Optional[str]) -> Optional[str]:
        return normalize_phone(value)


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
