from pydantic import BaseModel, EmailStr

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetVerifyRequest(BaseModel):
    email: EmailStr
    code: str

class PasswordResetPerformRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str
