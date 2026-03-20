from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.auth.security import get_current_user
from app.models.user import User
from app.schemas.session import SessionResponse, SessionUpdate, SessionWeekUpdate
from app.services.session_service import (
    get_sessions,
    update_session,
    update_sessions_in_week,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("/", response_model=list[SessionResponse])
def read_sessions(db: Session = Depends(get_db)):
    """Devuelve todas las sesiones registradas."""
    return get_sessions(db)


@router.patch("/week", response_model=list[SessionResponse])
def patch_week_sessions(
    update_data: SessionWeekUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permite al entrenador ajustar en bloque una semana concreta de sesiones."""
    if current_user.role not in ("trainer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo entrenadores o administradores pueden modificar sesiones",
        )
    return update_sessions_in_week(
        db, current_user.id, update_data.week_start_date, update_data
    )


@router.patch("/{session_id}", response_model=SessionResponse)
def patch_session(
    session_id: int,
    update_data: SessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permite al entrenador ajustar manualmente una sesion concreta (PATCH parcial).
    Solo el entrenador propietario (trainer_id) puede modificar su sesión.
    """
    if current_user.role not in ("trainer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo entrenadores o administradores pueden modificar sesiones",
        )
    return update_session(db, session_id, update_data, current_user.id)
