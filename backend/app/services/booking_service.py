from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.roles import is_admin_role
from app.models.booking import Booking
from app.models.session import SessionModel
from app.models.user import User
from app.services.notification_service import send_push_notification
from app.utils.utils import is_past_session_datetime, to_local_datetime


PAST_SESSION_MUTATION_ERROR = "No se pueden modificar reservas de clases iniciadas o pasadas"
ACTIVE_BOOKING_STATUS = "active"
CANCELLED_BOOKING_STATUS = "cancelled"
WAITLIST_BOOKING_STATUS = "waitlist"
OFFERED_BOOKING_STATUS = "offered"
WAITLIST_OFFER_TTL_MINUTES = 15
CLIENT_CANCELLATION_MIN_HOURS = 2
CLIENT_CANCELLATION_WINDOW_ERROR = "Solo puedes cancelar con al menos 2 horas de antelación"
LIVE_BOOKING_STATUSES = (
    ACTIVE_BOOKING_STATUS,
    WAITLIST_BOOKING_STATUS,
    OFFERED_BOOKING_STATUS,
)
RESERVED_BOOKING_STATUSES = (
    ACTIVE_BOOKING_STATUS,
    OFFERED_BOOKING_STATUS,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _has_minimum_client_cancellation_notice(session: SessionModel) -> bool:
    """Indica si el cliente todavía está dentro del plazo permitido para cancelar."""
    session_start = _as_utc(session.start_time)
    if session_start is None:
        return False
    return (session_start - _utc_now()) >= timedelta(hours=CLIENT_CANCELLATION_MIN_HOURS)


def _count_active_bookings(db: Session, session_id: int) -> int:
    """Cuenta cuántas reservas activas tiene una sesión."""
    return (
        db.query(Booking)
        .filter(Booking.session_id == session_id, Booking.status == ACTIVE_BOOKING_STATUS)
        .count()
    )


def _count_reserved_slots(db: Session, session_id: int) -> int:
    """Cuenta plazas ocupadas o temporalmente retenidas (active + offered)."""
    return (
        db.query(Booking)
        .filter(
            Booking.session_id == session_id,
            Booking.status.in_(RESERVED_BOOKING_STATUSES),
        )
        .count()
    )


def _month_boundaries(reference: datetime) -> tuple[datetime, datetime]:
    """Devuelve [inicio_mes, inicio_mes_siguiente] en UTC para filtrar sesiones."""
    current_month_start = datetime(reference.year, reference.month, 1, tzinfo=timezone.utc)
    if reference.month == 12:
        next_month_start = datetime(reference.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        next_month_start = datetime(reference.year, reference.month + 1, 1, tzinfo=timezone.utc)
    return current_month_start, next_month_start


def _count_user_monthly_active_bookings(db: Session, user_id: int, session_start_time: datetime) -> int:
    """Cuenta reservas activas de un cliente dentro del mes de la sesión a reservar."""
    month_start, next_month_start = _month_boundaries(session_start_time)
    return (
        db.query(Booking)
        .join(SessionModel, SessionModel.id == Booking.session_id)
        .filter(
            Booking.user_id == user_id,
            Booking.status == ACTIVE_BOOKING_STATUS,
            SessionModel.start_time >= month_start,
            SessionModel.start_time < next_month_start,
        )
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
        OFFERED_BOOKING_STATUS: 3,
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


def _collapse_latest_bookings_by_user_session(bookings: list[Booking]) -> list[Booking]:
    """Deja una sola reserva visible por pareja (usuario, sesión), usando el estado más reciente.

    Esto evita que vistas como `BuscarForm` muestren histórico antiguo (por ejemplo,
    una fila `active` vieja) después de que la reserva actual ya esté `cancelled`.
    """
    if not bookings:
        return []

    fallback_min_dt = datetime.min.replace(tzinfo=timezone.utc)
    latest_by_user_session: dict[tuple[int, int], Booking] = {}
    ordered_bookings = sorted(
        bookings,
        key=lambda booking: (
            _as_utc(getattr(booking, "created_at", None)) or fallback_min_dt,
            booking.id,
        ),
        reverse=True,
    )

    for booking in ordered_bookings:
        latest_by_user_session.setdefault((booking.user_id, booking.session_id), booking)

    return list(latest_by_user_session.values())


def _is_offer_expired(booking: Booking) -> bool:
    expires_at = _as_utc(getattr(booking, "offer_expires_at", None))
    return expires_at is not None and expires_at <= _utc_now()


def _send_waitlist_offer_notification(session: SessionModel, booking: Booking, user: User) -> None:
    if not user.fcm_token:
        return

    class_name = (session.class_name or "tu clase").strip() or "tu clase"
    local_start = to_local_datetime(session.start_time)
    session_date = local_start.strftime("%d/%m/%Y")
    session_date_iso = local_start.strftime("%Y-%m-%d")
    session_time = local_start.strftime("%H:%M")

    send_push_notification(
        tokens=[user.fcm_token],
        title="¡Se ha liberado una plaza!",
        body=f"Ya hay hueco en {class_name} el {session_date} a las {session_time}. Tienes 15 minutos para confirmar tu sitio.",
        data={
            "type": "waitlist_available",
            "session_id": str(session.id),
            "booking_id": str(booking.id),
            "session_date": session_date_iso,
            "offer_expires_in_minutes": str(WAITLIST_OFFER_TTL_MINUTES),
        },
    )


def _process_waitlist_for_session(db: Session, session: SessionModel) -> None:
    """Expira ofertas vencidas y, si hay hueco, ofrece la plaza al siguiente en cola."""
    expired_offers = (
        db.query(Booking)
        .filter(
            Booking.session_id == session.id,
            Booking.status == OFFERED_BOOKING_STATUS,
        )
        .order_by(Booking.created_at.asc(), Booking.id.asc())
        .all()
    )

    changed = False
    expired_booking_ids: set[int] = set()
    for offered_booking in expired_offers:
        if not _is_offer_expired(offered_booking):
            continue
        offered_booking.status = WAITLIST_BOOKING_STATUS
        offered_booking.offer_expires_at = None
        expired_booking_ids.add(offered_booking.id)
        changed = True

    if changed:
        db.flush()

    active_offer = (
        db.query(Booking)
        .filter(
            Booking.session_id == session.id,
            Booking.status == OFFERED_BOOKING_STATUS,
        )
        .order_by(Booking.created_at.asc(), Booking.id.asc())
        .first()
    )

    reserved_slots = _count_reserved_slots(db, session.id)
    _sync_session_status_with_capacity(session, reserved_slots)

    if active_offer is not None:
        if changed:
            db.commit()
            db.refresh(session)
        return

    if reserved_slots >= session.capacity:
        if changed:
            db.commit()
            db.refresh(session)
        return

    waitlist_query = (
        db.query(Booking)
        .filter(
            Booking.session_id == session.id,
            Booking.status == WAITLIST_BOOKING_STATUS,
        )
    )

    next_waitlist = None
    if expired_booking_ids:
        next_waitlist = (
            waitlist_query
            .filter(Booking.id.notin_(expired_booking_ids))
            .order_by(Booking.created_at.asc(), Booking.id.asc())
            .first()
        )

    if next_waitlist is None:
        next_waitlist = waitlist_query.order_by(Booking.created_at.asc(), Booking.id.asc()).first()

    if next_waitlist is None:
        if changed:
            db.commit()
            db.refresh(session)
        return

    next_waitlist.status = OFFERED_BOOKING_STATUS
    next_waitlist.offer_expires_at = _utc_now() + timedelta(minutes=WAITLIST_OFFER_TTL_MINUTES)
    _sync_session_status_with_capacity(session, reserved_slots + 1)
    db.commit()
    db.refresh(session)
    db.refresh(next_waitlist)

    user = db.query(User).filter(User.id == next_waitlist.user_id).first()
    if user is not None:
        _send_waitlist_offer_notification(session, next_waitlist, user)


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
            "offer_expires_at": booking.offer_expires_at,
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
    _process_waitlist_for_session(db, session)
    bookings = db.query(Booking).filter(Booking.session_id == session_id).all()
    visible_bookings = _collapse_session_bookings(bookings)
    return _attach_user_data(db, visible_bookings)


def get_all_bookings(db: Session) -> list[dict]:
    """Devuelve una sola fila visible por reserva actual de cada alumno en cada sesión."""
    bookings = db.query(Booking).all()
    visible_bookings = _collapse_latest_bookings_by_user_session(bookings)
    return _attach_user_data(db, visible_bookings)


def get_bookings_by_user(db: Session, user_id: int) -> list[dict]:
    """Devuelve la reserva visible más reciente del usuario para cada sesión."""
    # Verificar que el usuario existe
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    bookings = db.query(Booking).filter(Booking.user_id == user_id).all()
    session_ids = {booking.session_id for booking in bookings}
    if session_ids:
        sessions = db.query(SessionModel).filter(SessionModel.id.in_(session_ids)).all()
        for session in sessions:
            _process_waitlist_for_session(db, session)
        bookings = db.query(Booking).filter(Booking.user_id == user_id).all()
    visible_bookings = _collapse_latest_bookings_by_user_session(bookings)
    return _attach_user_data(db, visible_bookings)


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

    if not current_user.membership_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Membresía inactiva. Contacta con administración.",
        )

    if current_user.monthly_booking_quota is not None:
        session_start = _as_utc(session.start_time)
        if session_start is not None:
            used_slots = _count_user_monthly_active_bookings(db, current_user.id, session_start)
            if used_slots >= current_user.monthly_booking_quota:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Has alcanzado tu cupo mensual de reservas",
                )

    _process_waitlist_for_session(db, session)

    existing_booking = (
        db.query(Booking)
        .filter(
            Booking.user_id == current_user.id,
            Booking.session_id == booking_data.session_id,
        )
        .order_by(Booking.id.desc())
        .first()
    )
    if existing_booking is not None and existing_booking.status in LIVE_BOOKING_STATUSES:
        detail = (
            "El usuario ya tiene una reserva activa en esta sesión"
            if existing_booking.status == ACTIVE_BOOKING_STATUS
            else "El usuario ya está en cola para esta sesión"
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        )

    reserved_slots = _count_reserved_slots(db, booking_data.session_id)
    booking_status = (
        WAITLIST_BOOKING_STATUS
        if reserved_slots >= session.capacity
        else ACTIVE_BOOKING_STATUS
    )

    # Crear la reserva o reutilizar el último registro cancelado del alumno.
    if existing_booking is not None:
        booking = existing_booking
        booking.status = booking_status
        booking.offer_expires_at = None
        booking.created_at = _utc_now()
    else:
        booking = Booking(
            user_id=current_user.id,
            session_id=booking_data.session_id,
            status=booking_status,
        )
        db.add(booking)
    _sync_session_status_with_capacity(
        session,
        reserved_slots + (1 if booking_status == ACTIVE_BOOKING_STATUS else 0),
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        error_text = str(exc.orig)
        # El índice único parcial de la BD evita reservas duplicadas activas
        if "idx_unique_booking_active" in error_text:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El usuario ya tiene una reserva activa en esta sesión",
            )
        if "bookings_status_check" in error_text or "check constraint" in error_text.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La base de datos aún no tiene aplicada la migración de la cola",
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
    if is_admin_role(current_user.role):
        pass
    elif current_user.role == "client":
        if booking.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para cancelar esta reserva",
            )
        if not _has_minimum_client_cancellation_notice(session):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=CLIENT_CANCELLATION_WINDOW_ERROR,
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

    was_reserved_booking = booking.status in RESERVED_BOOKING_STATUSES
    booking.status = CANCELLED_BOOKING_STATUS
    booking.offer_expires_at = None
    db.flush()
    reserved_slots = _count_reserved_slots(db, booking.session_id)
    _sync_session_status_with_capacity(session, reserved_slots)
    db.commit()
    db.refresh(booking)

    if was_reserved_booking:
        _process_waitlist_for_session(db, session)

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

    if is_admin_role(current_user.role):
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

    _process_waitlist_for_session(db, session)
    db.refresh(booking)

    if booking.status not in (
        CANCELLED_BOOKING_STATUS,
        WAITLIST_BOOKING_STATUS,
        OFFERED_BOOKING_STATUS,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La reserva está '{booking.status}', no se puede reactivar",
        )

    if session.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede reactivar una reserva en una sesión cancelada",
        )

    if booking.status == OFFERED_BOOKING_STATUS:
        if _is_offer_expired(booking):
            booking.status = WAITLIST_BOOKING_STATUS
            booking.offer_expires_at = None
            db.commit()
            _process_waitlist_for_session(db, session)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La oferta ha expirado y la plaza ha pasado al siguiente en cola",
            )

        booking.status = ACTIVE_BOOKING_STATUS
        booking.offer_expires_at = None
        reserved_slots = _count_reserved_slots(db, booking.session_id)
        _sync_session_status_with_capacity(session, reserved_slots)
    else:
        reserved_slots = _count_reserved_slots(db, booking.session_id)
        _sync_session_status_with_capacity(session, reserved_slots)
        if reserved_slots >= session.capacity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La sesión está completa, no se puede reactivar la reserva",
            )

        booking.status = ACTIVE_BOOKING_STATUS
        booking.offer_expires_at = None
        _sync_session_status_with_capacity(session, reserved_slots + 1)
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
