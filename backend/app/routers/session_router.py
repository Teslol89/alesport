from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from app.database.db import get_db
from app.auth.security import get_current_user
from app.models.user import User
from app.schemas.session import SessionResponse, SessionUpdate, SessionWeekUpdate
from app.services.session_service import (
    get_sessions,
    get_sessions_by_date_range,
    update_session,
    update_sessions_in_week,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])

# Rutas para gestionar sesiones de entrenamiento. Solo accesibles por entrenadores y admins.
@router.get("/", response_model=list[SessionResponse])
def read_sessions(
    start_date: Optional[date] = Query(
        None, description="Fecha de inicio (YYYY-MM-DD)"
    ),
    end_date: Optional[date] = Query(None, description="Fecha de fin (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve todas las sesiones registradas, opcionalmente filtradas por rango de fechas."""
    if start_date or end_date:
        return get_sessions_by_date_range(db, start_date, end_date)
    return get_sessions(db)


@router.patch("/week", response_model=list[SessionResponse])
def patch_week_sessions(
    update_data: SessionWeekUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permite al entrenador ajustar en bloque una semana concreta de sesiones.
    Los admins deben incluir trainer_id en el body para indicar de qué entrenador.
    """
    if current_user.role not in ("trainer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo entrenadores o administradores pueden modificar sesiones",
        )
    if current_user.role == "admin":
        if update_data.trainer_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Los administradores deben especificar trainer_id en el body",
            )
        trainer_id = update_data.trainer_id
    else:
        trainer_id = current_user.id
    return update_sessions_in_week(
        db, trainer_id, update_data.week_start_date, update_data
    )


@router.patch("/{session_id}", response_model=SessionResponse)
def patch_session(
    session_id: int,
    update_data: SessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permite al entrenador o admin ajustar manualmente una sesión concreta (PATCH parcial).
    Los trainers solo pueden modificar sus propias sesiones.
    Los admins pueden modificar cualquiera.
    """
    if current_user.role not in ("trainer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo entrenadores o administradores pueden modificar sesiones",
        )
    return update_session(db, session_id, update_data, current_user)
