from pydantic import BaseModel

class GoogleLoginRequest(BaseModel):
    id_token: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
