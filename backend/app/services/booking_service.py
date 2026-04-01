from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.session import SessionModel
from app.models.user import User


def _attach_user_data(db: Session, bookings: list[Booking]) -> list[Booking]:
    """Añade user_name y user_email dinámicamente a cada booking para respuestas enriquecidas."""
    if not bookings:
        return bookings

    user_ids = {booking.user_id for booking in bookings}
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    user_map = {user.id: user for user in users}

    for booking in bookings:
        user = user_map.get(booking.user_id)
        setattr(booking, "user_name", user.name if user else None)
        setattr(booking, "user_email", user.email if user else None)

    return bookings

def get_bookings_by_session(db: Session, session_id: int) -> list[Booking]:
    """Devuelve todas las reservas de una sesión concreta."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión no encontrada",
        )
    bookings = db.query(Booking).filter(Booking.session_id == session_id).all()
    return _attach_user_data(db, bookings)


def get_all_bookings(db: Session) -> list[Booking]:
    """Devuelve todas las reservas registradas en la base de datos."""
    bookings = db.query(Booking).all()
    return _attach_user_data(db, bookings)


def get_bookings_by_user(db: Session, user_id: int) -> list[Booking]:
    """Devuelve todas las reservas de un usuario concreto."""
    # Verificar que el usuario existe
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    bookings = db.query(Booking).filter(Booking.user_id == user_id).all()
    return _attach_user_data(db, bookings)


def create_booking(db: Session, current_user: User, booking_data) -> Booking:
    """Crea una nueva reserva para un cliente en una sesión concreta.
    Valida:
    - Que solo usuarios con rol 'client' puedan reservar
    - Que la sesión existe y está activa
    - Que hay plazas disponibles (capacidad - reservas activas > 0)
    - Que el usuario no tiene ya una reserva activa en esa sesión
    """
    # get_current_user ya garantiza que el usuario existe y está activo
    if current_user.role != "client":
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
    user = db.query(User).filter(User.id == booking.user_id).first()
    setattr(booking, "user_name", user.name if user else None)
    setattr(booking, "user_email", user.email if user else None)
    return booking


def reactivate_booking(db: Session, booking_id: int, current_user: User) -> Booking:
    """Reactiva una reserva cancelada respetando permisos, estado de sesión y cupo."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reserva no encontrada",
        )

    session = db.query(SessionModel).filter(SessionModel.id == booking.session_id).first()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión no encontrada",
        )

    if current_user.role == "admin":
        pass
    elif current_user.role == "client":
        if booking.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para reactivar esta reserva",
            )
    elif current_user.role == "trainer":
        if session.trainer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes reactivar reservas de sesiones de otro entrenador",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Rol no autorizado para reactivar reservas",
        )

    if booking.status != "cancelled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La reserva está '{booking.status}', no se puede reactivar",
        )

    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede reactivar en una sesión con estado '{session.status}'",
        )

    active_bookings_count = (
        db.query(Booking)
        .filter(Booking.session_id == booking.session_id, Booking.status == "active")
        .count()
    )
    if active_bookings_count >= session.capacity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La sesión está completa, no se puede reactivar la reserva",
        )

    booking.status = "active"
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if "idx_unique_booking_active" in str(exc.orig):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una reserva activa para este usuario en esta sesión",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo reactivar la reserva",
        )

    db.refresh(booking)
    user = db.query(User).filter(User.id == booking.user_id).first()
    setattr(booking, "user_name", user.name if user else None)
    setattr(booking, "user_email", user.email if user else None)
    return booking
