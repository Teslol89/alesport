from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.auth.security import get_current_user
from app.models.user import User
from app.models.session import SessionModel
from app.schemas.booking import BookingCreate, BookingResponse
from app.services.booking_service import (
    cancel_booking,
    create_booking,
    get_all_bookings,
    get_bookings_by_user,
    get_bookings_by_session,
    reactivate_booking,
)

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("/session/{session_id}", response_model=list[BookingResponse])
def read_bookings_by_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve todas las reservas de una sesión concreta (admin o entrenador de la sesión)."""
    # Solo admin o el entrenador de la sesión pueden ver las reservas
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if current_user.role != "admin" and session.trainer_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="No autorizado para ver reservas de esta sesión"
        )
    return get_bookings_by_session(db, session_id)


@router.get("/", response_model=list[BookingResponse])
def read_all_bookings(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Devuelve todas las reservas registradas (uso administrativo)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden ver todas las reservas",
        )
    return get_all_bookings(db)


@router.get("/user/{user_id}", response_model=list[BookingResponse])
def read_bookings_by_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve todas las reservas de un usuario concreto."""
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden ver reservas de otros usuarios",
        )
    return get_bookings_by_user(db, user_id)


@router.post("/", response_model=BookingResponse, status_code=201)
def book_session(
    booking_data: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crea una nueva reserva para un cliente en una sesión concreta."""
    return create_booking(db, current_user, booking_data)


@router.patch("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking_endpoint(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancela una reserva activa. No elimina el registro, cambia el estado a 'cancelled'."""
    return cancel_booking(db, booking_id, current_user)


@router.patch("/{booking_id}/reactivate", response_model=BookingResponse)
def reactivate_booking_endpoint(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reactiva una reserva cancelada cuando la sesión está activa y hay cupo."""
    return reactivate_booking(db, booking_id, current_user)
