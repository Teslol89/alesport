from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.session import SessionModel
from app.models.user import User
from app.utils.utils import is_past_session_datetime


PAST_SESSION_MUTATION_ERROR = "No se pueden modificar reservas de días pasados"
ACTIVE_BOOKING_STATUS = "active"
CANCELLED_BOOKING_STATUS = "cancelled"
WAITLIST_BOOKING_STATUS = "waitlist"
LIVE_BOOKING_STATUSES = (ACTIVE_BOOKING_STATUS, WAITLIST_BOOKING_STATUS)


def _count_active_bookings(db: Session, session_id: int) -> int:
    """Cuenta cuántas reservas activas tiene una sesión."""
    return (
        db.query(Booking)
        .filter(Booking.session_id == session_id, Booking.status == ACTIVE_BOOKING_STATUS)
        .count()
    )


def _sync_session_status_with_capacity(
    session: SessionModel, active_bookings_count: int
) -> None:
    """Mantiene el estado de sesión alineado con su ocupación.

    - cancelled se respeta como cierre manual
    - completed significa aforo completo
    - active significa que aún admite reservas
    """
    if session.status == "cancelled":
        return

    session.status = (
        "completed" if active_bookings_count >= session.capacity else "active"
    )


def _collapse_session_bookings(bookings: list[Booking]) -> list[Booking]:
    """Reduce la lista de reservas a una sola entrada visible por alumno.

    Si un alumno tiene histórico de cancelaciones/reactivaciones para la misma sesión,
    se prioriza la reserva activa; si no hay ninguna activa, se muestra la más reciente.
    """
    if not bookings:
        return []

    latest_by_user: dict[int, Booking] = {}
    status_priority = {
        ACTIVE_BOOKING_STATUS: 2,
        WAITLIST_BOOKING_STATUS: 1,
        CANCELLED_BOOKING_STATUS: 0,
    }
    ordered_bookings = sorted(
        bookings,
        key=lambda booking: (status_priority.get(booking.status, -1), booking.id),
        reverse=True,
    )

    for booking in ordered_bookings:
        latest_by_user.setdefault(booking.user_id, booking)

    return list(latest_by_user.values())


def _attach_user_data(db: Session, bookings: list[Booking]) -> list[dict]:
    """Añade user_name, user_email y session_start_time a cada booking para respuestas enriquecidas."""
    if not bookings:
        return []

    user_ids = {booking.user_id for booking in bookings}
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    user_map = {user.id: user for user in users}

    session_ids = {booking.session_id for booking in bookings}
    sessions = db.query(SessionModel).filter(SessionModel.id.in_(session_ids)).all()
    session_map = {session.id: session for session in sessions}

    enriched_bookings = []
    for booking in bookings:
        user = user_map.get(booking.user_id)
        session = session_map.get(booking.session_id)

        booking_dict = {
            "id": booking.id,
            "user_id": booking.user_id,
            "session_id": booking.session_id,
            "status": booking.status,
            "created_at": booking.created_at,
            "session_start_time": session.start_time if session else None,
            "user_name": user.name if user else None,
            "user_email": user.email if user else None,
        }
        enriched_bookings.append(booking_dict)

    return enriched_bookings


def get_bookings_by_session(db: Session, session_id: int) -> list[dict]:
    """Devuelve una vista limpia de las reservas de una sesión concreta.

    En detalles de clase solo debe verse una vez cada alumno, aunque exista
    histórico de cancelaciones/reactivaciones para la misma sesión.
    """
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión no encontrada",
        )
    bookings = db.query(Booking).filter(Booking.session_id == session_id).all()
    visible_bookings = _collapse_session_bookings(bookings)
    return _attach_user_data(db, visible_bookings)


def get_all_bookings(db: Session) -> list[dict]:
    """Devuelve todas las reservas registradas en la base de datos."""
    bookings = db.query(Booking).all()
    return _attach_user_data(db, bookings)


def get_bookings_by_user(db: Session, user_id: int) -> list[dict]:
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

    if is_past_session_datetime(session.start_time):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=PAST_SESSION_MUTATION_ERROR,
        )

    # Solo se puede reservar en sesiones no canceladas.
    # Si estaba marcada como 'completed' pero realmente tiene hueco,
    # el estado se corrige automáticamente más abajo.
    if session.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede reservar una sesión cancelada",
        )

    existing_live_booking = (
        db.query(Booking)
        .filter(
            Booking.user_id == current_user.id,
            Booking.session_id == booking_data.session_id,
            Booking.status.in_(LIVE_BOOKING_STATUSES),
        )
        .first()
    )
    if existing_live_booking is not None:
        detail = (
            "El usuario ya tiene una reserva activa en esta sesión"
            if existing_live_booking.status == ACTIVE_BOOKING_STATUS
            else "El usuario ya está en cola para esta sesión"
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        )

    active_bookings_count = _count_active_bookings(db, booking_data.session_id)
    booking_status = (
        WAITLIST_BOOKING_STATUS
        if active_bookings_count >= session.capacity
        else ACTIVE_BOOKING_STATUS
    )

    # Crear la reserva o la entrada en lista de espera.
    booking = Booking(
        user_id=current_user.id,
        session_id=booking_data.session_id,
        status=booking_status,
    )
    db.add(booking)
    _sync_session_status_with_capacity(
        session,
        active_bookings_count + (1 if booking_status == ACTIVE_BOOKING_STATUS else 0),
    )
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

    session = db.query(SessionModel).filter(SessionModel.id == booking.session_id).first()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión no encontrada",
        )

    if is_past_session_datetime(session.start_time):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=PAST_SESSION_MUTATION_ERROR,
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

    # Se puede cancelar una reserva activa o salir de la cola.
    if booking.status not in LIVE_BOOKING_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La reserva ya está '{booking.status}', no se puede cancelar",
        )

    booking.status = CANCELLED_BOOKING_STATUS
    db.flush()
    active_bookings_count = _count_active_bookings(db, booking.session_id)
    _sync_session_status_with_capacity(session, active_bookings_count)
    db.commit()
    db.refresh(booking)
    user = db.query(User).filter(User.id == booking.user_id).first()
    setattr(booking, "user_name", user.name if user else None)
    setattr(booking, "user_email", user.email if user else None)
    return booking


def reactivate_booking(db: Session, booking_id: int, current_user: User) -> Booking:
    """Activa o reactiva una reserva en cola/cancelada respetando permisos y cupo."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reserva no encontrada",
        )

    session = (
        db.query(SessionModel).filter(SessionModel.id == booking.session_id).first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión no encontrada",
        )

    if is_past_session_datetime(session.start_time):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=PAST_SESSION_MUTATION_ERROR,
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

    if booking.status not in (CANCELLED_BOOKING_STATUS, WAITLIST_BOOKING_STATUS):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La reserva está '{booking.status}', no se puede reactivar",
        )

    if session.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede reactivar una reserva en una sesión cancelada",
        )

    active_bookings_count = _count_active_bookings(db, booking.session_id)
    _sync_session_status_with_capacity(session, active_bookings_count)
    if active_bookings_count >= session.capacity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La sesión está completa, no se puede reactivar la reserva",
        )

    booking.status = ACTIVE_BOOKING_STATUS
    _sync_session_status_with_capacity(session, active_bookings_count + 1)
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
