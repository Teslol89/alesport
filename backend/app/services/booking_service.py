from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.session import SessionModel
from app.models.user import User


def get_all_bookings(db: Session) -> list[Booking]:
    """Devuelve todas las reservas registradas en la base de datos."""
    return db.query(Booking).all()


def get_bookings_by_user(db: Session, user_id: int) -> list[Booking]:
    """Devuelve todas las reservas de un usuario concreto."""
    # Verificar que el usuario existe
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    return db.query(Booking).filter(Booking.user_id == user_id).all()


def create_booking(db: Session, current_user: User, booking_data) -> Booking:
    """Crea una nueva reserva para un cliente en una sesión concreta.
    Valida:
    - Que la sesión existe y está activa
    - Que hay plazas disponibles (capacidad - reservas activas > 0)
    - Que el usuario no tiene ya una reserva activa en esa sesión
    - Que solo usuarios con rol 'client' puedan reservar
    """
    # Verificar que el usuario existe y es cliente activo
    user = db.query(User).filter(User.id == current_user.id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo: no puede realizar reservas",
        )

    if user.role != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los clientes pueden reservar sesiones",
        )

    # Verificar que la sesión existe
    session = (
        db.query(SessionModel)
        .filter(SessionModel.id == booking_data.session_id)
        .first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión no encontrada",
        )

    # Solo se puede reservar en sesiones activas
    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede reservar una sesión con estado '{session.status}'",
        )

    # Verificar que hay plazas disponibles
    active_bookings_count = (
        db.query(Booking)
        .filter(
            Booking.session_id == booking_data.session_id,
            Booking.status == "active",
        )
        .count()
    )
    if active_bookings_count >= session.capacity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La sesión está completa, no hay plazas disponibles",
        )

    # Crear la reserva
    booking = Booking(
        user_id=current_user.id,
        session_id=booking_data.session_id,
        status="active",
    )
    db.add(booking)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # El índice único parcial de la BD evita reservas duplicadas activas
        if "idx_unique_booking_active" in str(exc.orig):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El usuario ya tiene una reserva activa en esta sesión",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Datos de reserva inválidos",
        )

    db.refresh(booking)
    return booking


def cancel_booking(db: Session, booking_id: int, current_user: User) -> Booking:
    """Cancela una reserva cambiando su estado a 'cancelled'.
    Reglas:
    - client: solo puede cancelar sus propias reservas
    - trainer: solo puede cancelar reservas de sesiones donde él es el entrenador
    - admin: puede cancelar cualquier reserva
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reserva no encontrada",
        )

    # Autorización por rol
    if current_user.role == "admin":
        pass
    elif current_user.role == "client":
        if booking.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para cancelar esta reserva",
            )
    elif current_user.role == "trainer":
        session = (
            db.query(SessionModel).filter(SessionModel.id == booking.session_id).first()
        )
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sesión no encontrada",
            )
        if session.trainer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes cancelar reservas de sesiones de otro entrenador",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Rol no autorizado para cancelar reservas",
        )

    # Solo se puede cancelar una reserva activa
    if booking.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La reserva ya está '{booking.status}', no se puede cancelar",
        )

    booking.status = "cancelled"
    db.commit()
    db.refresh(booking)
    return booking
