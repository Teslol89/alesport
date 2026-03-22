
# --- IMPORTS ORDENADOS Y COMPLETOS ---
from fastapi import APIRouter, Depends, HTTPException, status, Path
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.auth.security import get_current_user
from app.database.db import get_db
from app.models.user import User, User as UserModel
from app.schemas.user import UserResponse
from app.services.user_service import get_all_users

# --- INICIALIZAR ROUTER ANTES DE USARLO ---
router = APIRouter(prefix="/users", tags=["users"])

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
