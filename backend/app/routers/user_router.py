
# --- IMPORTS ORDENADOS Y COMPLETOS ---
import os
from fastapi import APIRouter, Depends, HTTPException, status, Path, Body, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.auth.security import get_current_user
from app.database.db import get_db
from app.models.user import User, User as UserModel
from app.schemas.user import UserResponse
from app.services.user_service import get_all_users

# --- INICIALIZAR ROUTER ANTES DE USARLO ---
router = APIRouter(prefix="/users", tags=["users"])
# --- ENDPOINT SOLO PARA TEST/CI: Forzar verificación de usuario ---
class ForceVerifyEmailRequest(BaseModel):
    email: str

@router.patch("/verify-email", tags=["users"])
def force_verify_email(
    payload: ForceVerifyEmailRequest = Body(...),
    db: Session = Depends(get_db),
):
    """Endpoint SOLO para test/CI: fuerza la verificación de un usuario por email. Protegido por variable de entorno."""
    if os.environ.get("ALESPORT_ENV") not in ("test", "ci", "dev", "development"):
        raise HTTPException(status_code=403, detail="No permitido en este entorno")
    user = db.query(UserModel).filter(UserModel.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.is_verified = True
    db.commit()
    db.refresh(user)
    return {"message": f"Usuario {user.email} verificado forzadamente"}

# --- IMPORTS ORDENADOS Y COMPLETOS ---
from fastapi import APIRouter, Depends, HTTPException, status, Path
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.auth.security import get_current_user
from app.database.db import get_db
from app.models.user import User, User as UserModel
from app.schemas.user import UserResponse
from app.services.user_service import get_all_users
from app.models.user import User as UserModel
from fastapi import Query


# --- INICIALIZAR ROUTER ANTES DE USARLO ---
router = APIRouter(prefix="/users", tags=["users"])

# --- ENDPOINTS PÚBLICOS PARA USUARIO PENDIENTE DE VERIFICACIÓN ---
@router.get("/pending/{email}", response_model=UserResponse, tags=["users"])
def get_pending_user_by_email(
    email: str = Path(..., description="Email del usuario pendiente a consultar"),
    db: Session = Depends(get_db),
):
    """Devuelve el usuario pendiente (no verificado) por email. 404 si no existe o ya está verificado."""
    user = db.query(UserModel).filter(UserModel.email == email).first()
    if not user or user.is_verified:
        raise HTTPException(status_code=404, detail="Usuario pendiente no encontrado")
    return user


@router.delete("/pending/{email}", status_code=204, tags=["users"])
def delete_pending_user_by_email(
    email: str = Path(..., description="Email del usuario pendiente a eliminar"),
    db: Session = Depends(get_db),
):
    """Elimina el usuario pendiente (no verificado) por email. 404 si no existe o ya está verificado."""
    user = db.query(UserModel).filter(UserModel.email == email).first()
    if not user or user.is_verified:
        raise HTTPException(status_code=404, detail="Usuario pendiente no encontrado")
    db.delete(user)
    db.commit()
    return

# --- ESQUEMA PATCH ---
class UserUpdateIsActive(BaseModel):
    is_active: bool

# --- ENDPOINT PATCH PARA is_active ---
from fastapi import Body

@router.patch("/{user_id}", response_model=UserResponse)
def patch_user_is_active(
    user_id: int = Path(..., description="ID del usuario a modificar"),
    update: UserUpdateIsActive = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permite a un admin activar/desactivar usuarios (campo is_active)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo admin puede modificar usuarios")
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.is_active = update.is_active
    db.commit()
    db.refresh(user)
    return user


@router.get("/", response_model=list[UserResponse])
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve todos los usuarios registrados (uso administrativo)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden ver la lista de usuarios",
        )
    return get_all_users(db)
