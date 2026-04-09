# ── Rutas de autenticación ─────────────────────────────────────────────────────
# Estas rutas permiten a los usuarios autenticarse y obtener un token JWT, así como acceder a su propia
# información básica. La ruta de login verifica las credenciales y genera un token, mientras que la ruta /me
# devuelve los datos del usuario autenticado.
# 1.    POST /auth/login valida email/password. Si son correctos, devuelve un JWT con la información del usuario.
# 2.    Si las credenciales son correctas, genera JWT con sub=user.email.
# 3.    Guarda last_login en UTC.
# 4.    GET /auth/me requiere un token JWT válido y devuelve los datos básicos del usuario autenticado
#       (id, email, name, role, is_active).

from datetime import datetime, timezone
import random
import string

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.auth.security import create_access_token, get_current_user, hash_password, verify_password
from app.database.db import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse
from app.schemas.password_reset import PasswordResetPerformRequest, PasswordResetRequest, PasswordResetVerifyRequest
from app.schemas.user import UserCreate, UserResponse
from app.services.user_service import create_user, send_password_reset_email


# ─ RUTAS DE AUTENTICACIÓN ─────────────────────────────────────────────────────
router = APIRouter(prefix="/auth", tags=["auth"])


# ── Login con email y contraseña ─────────────────────────────────────────────
@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Autentica a un usuario y devuelve un token JWT si las credenciales son válidas."""
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta desactivada",
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debes verificar tu email antes de iniciar sesión. Revisa tu correo.",
        )
    access_token = create_access_token(
        {"sub": user.email, "user_id": user.id, "role": user.role}
    )

    user.last_login = datetime.now(timezone.utc)
    db.commit()  # Guardar el timestamp del último login
    return LoginResponse(access_token=access_token, token_type="bearer")


# ── Obtener datos del usuario autenticado ─────────────────────────────────────
@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Devuelve información básica del usuario autenticado."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "membership_active": current_user.membership_active,
        "phone": current_user.phone,
        "avatar_url": current_user.avatar_url,
    }



# ── Registro de usuario ──────────────────────────────────────────────────────


# Registro de usuario (async)
@router.post("/register", response_model=UserResponse, status_code=201)
async def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    """Registra un usuario nuevo (rol 'client')."""
    try:
        user = await create_user(db, payload)
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Nuevo endpoint para verificación por código
class VerifyEmailCodeRequest(BaseModel):
    email: EmailStr
    code: str


@router.post("/verify-email-code")
async def verify_email_code(
    payload: VerifyEmailCodeRequest, db: Session = Depends(get_db)
):
    """Verifica el email del usuario usando el código recibido por correo."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.is_verified:
        return {"message": "¡Email ya verificado!"}
    if (
        user.verification_code
        and user.verification_code.strip().upper() == payload.code.strip().upper()
    ):
        user.is_verified = True
        user.verification_code = None
        db.commit()
        return {"message": "¡Email verificado correctamente! Ya puedes iniciar sesión."}
    raise HTTPException(
        status_code=400, detail="Código de verificación inválido o expirado"
    )


# ── Recuperación de contraseña ───────────────────────────────────────────────
from app.services.user_service import send_password_reset_email


@router.post("/request-password-reset")
async def request_password_reset(
    payload: PasswordResetRequest, db: Session = Depends(get_db)
):
    """Inicia el flujo de recuperación de contraseña: genera y envía un código al email."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        # No revelar si el email existe o no
        return {
            "message": "Si el email existe, se ha enviado un código de recuperación."
        }
    # Generar código de 6 dígitos
    code = "".join(random.choices(string.digits, k=6))
    user.verification_code = code
    db.commit()
    # Enviar email de recuperación
    await send_password_reset_email(user.email, code)
    return {"message": "Si el email existe, se ha enviado un código de recuperación."}


# ── Verificar código de recuperación ─────────────────────────────────────────
@router.post("/verify-password-reset-code")
async def verify_password_reset_code(
    payload: PasswordResetVerifyRequest, db: Session = Depends(get_db)
):
    """Verifica el código de recuperación enviado al email."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if (
        not user.verification_code
        or user.verification_code.strip() != payload.code.strip()
    ):
        raise HTTPException(status_code=400, detail="Código incorrecto o expirado")
    return {"message": "Código verificado correctamente"}


@router.post("/reset-password")
async def reset_password(
    payload: PasswordResetPerformRequest, db: Session = Depends(get_db)
):
    """
    Cambia la contraseña del usuario si el código de recuperación es válido.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if (
        not user.verification_code
        or user.verification_code.strip() != payload.code.strip()
    ):
        raise HTTPException(status_code=400, detail="Código incorrecto o expirado")
    user.password_hash = hash_password(payload.new_password)
    user.verification_code = None  # Invalida el código tras el cambio
    db.commit()
    return {"message": "Contraseña cambiada correctamente"}
