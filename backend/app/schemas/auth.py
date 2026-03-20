from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    """Datos necesarios para iniciar sesión."""
    email: EmailStr
    password: str
    
class LoginResponse(BaseModel):
    """Datos devueltos al cliente tras un inicio de sesión exitoso."""
    access_token: str
    token_type: str = "bearer"
