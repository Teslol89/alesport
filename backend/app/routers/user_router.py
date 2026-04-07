# --- IMPORTS ORDENADOS Y COMPLETOS ---
import os
from fastapi import APIRouter, Depends, HTTPException, status, Path, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.auth.security import get_current_user
from app.database.db import get_db
from app.models.user import User, User as UserModel
from app.schemas.user import UserResponse, UserProfileUpdate
from app.services.user_service import get_all_users


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


@router.get("/me", response_model=UserResponse)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    """Devuelve el perfil del usuario autenticado."""
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_my_profile(
    update: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permite al usuario autenticado actualizar su nombre, teléfono y foto."""
    provided_fields = update.model_dump(exclude_unset=True)

    if "name" in provided_fields and update.name is not None:
        current_user.name = update.name
    if "phone" in provided_fields:
        current_user.phone = update.phone
    if "avatar_url" in provided_fields:
        current_user.avatar_url = update.avatar_url

    db.commit()
    db.refresh(current_user)
    return current_user


class FcmTokenUpdate(BaseModel):
    fcm_token: str


@router.patch("/me/fcm-token", status_code=204)
def update_fcm_token(
    payload: FcmTokenUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Guarda o actualiza el token FCM del dispositivo del usuario autenticado."""
    current_user.fcm_token = payload.fcm_token
    db.commit()
    return


# --- ENDPOINT PATCH PARA is_active ---
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
