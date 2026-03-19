from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.schemas.booking import BookingCreate, BookingResponse
from app.services.booking_service import (
    cancel_booking,
    create_booking,
    get_all_bookings,
    get_bookings_by_user,
)

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("/", response_model=list[BookingResponse])
def read_all_bookings(db: Session = Depends(get_db)):
    """Devuelve todas las reservas registradas (uso administrativo)."""
    return get_all_bookings(db)


@router.get("/user/{user_id}", response_model=list[BookingResponse])
def read_bookings_by_user(user_id: int, db: Session = Depends(get_db)):
    """Devuelve todas las reservas de un usuario concreto."""
    return get_bookings_by_user(db, user_id)


@router.post("/", response_model=BookingResponse, status_code=201)
def book_session(booking_data: BookingCreate, db: Session = Depends(get_db)):
    """Crea una nueva reserva para un cliente en una sesión concreta."""
    return create_booking(db, booking_data)


@router.patch("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking_endpoint(booking_id: int, user_id: int, db: Session = Depends(get_db)):
    """Cancela una reserva activa. No elimina el registro, cambia el estado a 'cancelled'."""
    return cancel_booking(db, booking_id, user_id)
