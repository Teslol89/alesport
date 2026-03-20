from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.security import create_access_token, get_current_user, verify_password
from app.database.db import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Rutas de autenticación ─────────────────────────────────────────────────────
# Estas rutas permiten a los usuarios autenticarse y obtener un token JWT, así como acceder a su propia
# información básica. La ruta de login verifica las credenciales y genera un token, mientras que la ruta /me
# devuelve los datos del usuario autenticado.
# 1.    POST /auth/login valida email/password. Si son correctos, devuelve un JWT con la información del usuario.
# 2.    Si las credenciales son correctas, genera JWT con sub=user.email.
# 3.    Guarda last_login en UTC.
# 4.    GET /auth/me requiere un token JWT válido y devuelve los datos básicos del usuario autenticado
#       (id, email, name, role, is_active).


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
    access_token = create_access_token(
        {"sub": user.email, "user_id": user.id, "role": user.role}
    )

    user.last_login = datetime.now(timezone.utc)
    db.commit()  # Guardar el timestamp del último login
    return LoginResponse(access_token=access_token, token_type="bearer")


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Devuelve información básica del usuario autenticado."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "is_active": current_user.is_active,
    }
