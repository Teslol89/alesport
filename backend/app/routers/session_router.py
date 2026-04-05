from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from app.database.db import get_db
from app.auth.security import get_current_user
from app.models.user import User
from app.schemas.session import (
    SessionCreate,
    SessionResponse,
    SessionUpdate,
    SessionWeekUpdate,
    SessionRecurringCreateList,
)
from app.services.session_service import (
    create_session,
    get_sessions,
    get_sessions_by_date_range,
    update_session,
    update_sessions_in_week,
    create_recurring_sessions,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


# --- Rutas para gestionar sesiones de entrenamiento. Solo accesibles por entrenadores y admins. --- #
@router.post("/", response_model=SessionResponse, status_code=201)
def create_single_session(
    create_data: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crea una nueva sesión puntual (clase concreta con fecha y hora específicas).

    Trainers pueden crear solo sus propias sesiones.
    Admins pueden crear sesiones para cualquier trainer (especificando trainer_id en body).
    """
    return create_session(db, create_data, current_user)


# --- Endpoint para obtener sesiones, con opción de filtrar por rango de fechas --- #
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


# --- Endpoint para actualizar sesiones (PATCH parcial) y cancelar sesiones (soft delete) --- #
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


# --- Endpoint para generar sesiones recurrentes automáticamente a partir de horarios semanales --- #
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


# --- Endpoint para cancelar sesiones (soft delete) --- #
@router.delete("/{session_id}", response_model=SessionResponse)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancela una sesión (soft delete: cambia status a 'cancelled').
    La sesión se mantiene en BD para auditoría pero desaparece de vistas activas.
    Los trainers solo pueden cancelar sus propias sesiones.
    Los admins pueden cancelar cualquiera.
    """
    if current_user.role not in ("trainer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo entrenadores o administradores pueden cancelar sesiones",
        )
    # Llamar a update_session con status='cancelled'
    cancel_data = SessionUpdate(status="cancelled")
    return update_session(db, session_id, cancel_data, current_user)


# --- Endpoint para crear sesiones recurrentes de forma transaccional --- #
@router.post("/recurring", response_model=list[SessionResponse], status_code=201)
def create_recurring_sessions_endpoint(
    create_data_list: SessionRecurringCreateList,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crea varias sesiones recurrentes en una sola transacción. Si alguna falla, se hace rollback de todas."""
    return create_recurring_sessions(db, create_data_list.sessions, current_user)
