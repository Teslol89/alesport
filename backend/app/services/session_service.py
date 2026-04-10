# services/session_service.py
from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.session import SessionModel
from app.models.user import User
from app.models.booking import Booking
import logging

from app.utils.utils import LOCAL_TIMEZONE, get_logger, is_past_session_datetime, to_local_datetime
from app.services.notification_service import send_push_notification

logger = get_logger(__name__)


PAST_SESSION_UPDATE_ERROR = "No se pueden modificar sesiones iniciadas o pasadas"


# --- Función para convertir hora con tz a hora local sin tzinfo --- #
def _to_local_naive_time(value: time) -> time:
    """Convierte una hora con tz (si viene) a hora local y la devuelve sin tzinfo."""
    if value.tzinfo is None:
        return value

    probe_date = date.today()
    localized = datetime.combine(probe_date, value).astimezone(LOCAL_TIMEZONE)
    return localized.timetz().replace(tzinfo=None)


# --- Función para validar que una franja horaria no se solape con otras sesiones activas (regla global) --- #
def _ensure_no_session_overlap(
    db: Session,
    start_time: datetime,
    end_time: datetime,
    exclude_session_id: int | None = None,
) -> None:
    """Valida que la franja no se solape con otra sesión no cancelada (regla global)."""
    candidate_start = start_time.astimezone(LOCAL_TIMEZONE)
    candidate_end = end_time.astimezone(LOCAL_TIMEZONE)

    overlap_query = db.query(SessionModel).filter(
        SessionModel.status != "cancelled",
    )

    if exclude_session_id is not None:
        overlap_query = overlap_query.filter(SessionModel.id != exclude_session_id)

    for existing_session in overlap_query.all():
        existing_start = existing_session.start_time.astimezone(LOCAL_TIMEZONE)
        existing_end = existing_session.end_time.astimezone(LOCAL_TIMEZONE)

        if existing_start < candidate_end and existing_end > candidate_start:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Esta sesión se solapa con otra sesión activa",
            )


# --- Función para crear una sesión puntual concreta --- #
def create_session(db: Session, create_data, current_user: User) -> SessionModel:
    """Crea una nueva sesión puntual concreta.

    Si current_user.role == 'admin' y create_data.trainer_id está especificado,
    se usa ese trainer_id. Caso contrario, se usa el del usuario autenticado
    (solo trainers y admins pueden crear sesiones).
    """
    if current_user.role not in ("trainer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo entrenadores o administradores pueden crear sesiones",
        )

    # Determinar trainer_id
    if current_user.role == "admin" and create_data.trainer_id is not None:
        trainer_id = create_data.trainer_id
        # Validar que el trainer existe
        trainer = db.query(User).filter(User.id == trainer_id).first()
        if not trainer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Usuario/entrenador con id {trainer_id} no encontrado",
            )
    else:
        trainer_id = current_user.id

    # Normalizar horas a local (evita desfases cuando llega hora con offset/UTC)
    start_local_time = _to_local_naive_time(create_data.start_time)
    end_local_time = _to_local_naive_time(create_data.end_time)

    # Convertir session_date + times a datetimes con timezone
    session_timezone = LOCAL_TIMEZONE
    start_dt = datetime.combine(
        create_data.session_date,
        start_local_time,
        tzinfo=session_timezone,
    )
    end_dt = datetime.combine(
        create_data.session_date,
        end_local_time,
        tzinfo=session_timezone,
    )

    _ensure_no_session_overlap(db, start_dt, end_dt)

    # Crear nuevo modelo de sesión
    new_session = SessionModel(
        trainer_id=trainer_id,
        start_time=start_dt,
        end_time=end_dt,
        capacity=create_data.capacity,
        class_name=create_data.class_name,
        notes=create_data.notes or None,
        status="active",
    )

    try:
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
    except IntegrityError as exc:
        db.rollback()
        if "no_overlap_sessions" in str(exc.orig):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Esta sesión se solapa con otra no cancelada del mismo entrenador",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Datos de sesión inválidos",
        )

    # Obtener nombre del trainer para response
    trainer = db.query(User).filter(User.id == trainer_id).first()
    setattr(new_session, "trainer_name", trainer.name if trainer else "")

    return new_session


# --- Función para preparar y validar un patch de sesión (conversión de horas y validación start<end) --- #
def _prepare_patch_for_session(session: SessionModel, patch: dict) -> dict:
    """Convierte patch de time->datetime y valida coherencia start/end para una sesión."""
    prepared_patch = dict(patch)
    session_timezone = LOCAL_TIMEZONE
    session_date = session.start_time.astimezone(LOCAL_TIMEZONE).date()

    if (
        "start_time" in prepared_patch
        and hasattr(prepared_patch["start_time"], "hour")
        and not hasattr(prepared_patch["start_time"], "date")
    ):
        local_start_time = _to_local_naive_time(prepared_patch["start_time"])
        prepared_patch["start_time"] = datetime.combine(
            session_date,
            local_start_time,
            tzinfo=session_timezone,
        )

    if (
        "end_time" in prepared_patch
        and hasattr(prepared_patch["end_time"], "hour")
        and not hasattr(prepared_patch["end_time"], "date")
    ):
        local_end_time = _to_local_naive_time(prepared_patch["end_time"])
        prepared_patch["end_time"] = datetime.combine(
            session_date,
            local_end_time,
            tzinfo=session_timezone,
        )

    if "start_time" in prepared_patch or "end_time" in prepared_patch:
        start = prepared_patch.get("start_time", session.start_time)
        end = prepared_patch.get("end_time", session.end_time)

        if start.tzinfo is None:
            start = start.replace(tzinfo=session_timezone)
        if end.tzinfo is None:
            end = end.replace(tzinfo=session_timezone)

        if start >= end:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="start_time debe ser anterior a end_time",
            )

    return prepared_patch


# --- Función para obtener sesiones (con join para nombre de entrenador) --- #
def get_sessions(db: Session) -> list[SessionModel]:
    logger.debug("¡Logger activo! Entrando en get_sessions")
    # Join con User para obtener el nombre del entrenador
    results = (
        db.query(SessionModel, User.name)
        .join(User, SessionModel.trainer_id == User.id)
        .all()
    )
    # Convertir a lista de dicts con trainer_name
    sessions = []
    for session_obj, trainer_name in results:
        session_dict = session_obj.__dict__.copy()
        session_dict["trainer_name"] = trainer_name
        sessions.append(session_dict)
    return sessions


# --- Función para filtrar sesiones por rango de fechas --- #
def get_sessions_by_date_range(
    db: Session, start_date: Optional[date] = None, end_date: Optional[date] = None
) -> list[SessionModel]:
    logger.debug("¡Logger activo! Entrando en get_sessions_by_date_range")
    logger.debug(f"[DEBUG] start_date: {start_date}, end_date: {end_date}")
    query = db.query(SessionModel, User.name).join(
        User, SessionModel.trainer_id == User.id
    )
    if start_date:
        query = query.filter(func.date(SessionModel.start_time) >= start_date)
    if end_date:
        query = query.filter(func.date(SessionModel.start_time) <= end_date)
    logger.debug(
        f"[DEBUG] SQL: {str(query.statement.compile(compile_kwargs={'literal_binds': True}))}"
    )
    results = query.all()
    sessions = []
    for session_obj, trainer_name in results:
        session_dict = session_obj.__dict__.copy()
        session_dict["trainer_name"] = trainer_name
        sessions.append(session_dict)
    return sessions


# --- Función para notificar a alumnos de cambio de hora en sesión --- #
def _notify_session_time_change(
    db: Session, session: SessionModel, old_start_time
) -> None:
    """Notifica por push a todos los alumnos con reserva activa en la sesión que cambió de hora."""
    bookings = (
        db.query(Booking)
        .filter(Booking.session_id == session.id, Booking.status == "active")
        .all()
    )
    if not bookings:
        return

    user_ids = [b.user_id for b in bookings]
    users = (
        db.query(User).filter(User.id.in_(user_ids), User.fcm_token.isnot(None)).all()
    )
    tokens = [u.fcm_token for u in users if u.fcm_token]

    if not tokens:
        return

    old_hour = to_local_datetime(old_start_time).strftime("%H:%M") if old_start_time else "?"
    local_start = to_local_datetime(session.start_time)
    new_hour = local_start.strftime("%H:%M")
    session_date = local_start.strftime("%d/%m/%Y")

    send_push_notification(
        tokens=tokens,
        title="Cambio de horario en tu clase",
        body=f"Tu clase del {session_date} ha cambiado de {old_hour} a {new_hour}.",
        data={"session_id": str(session.id)},
    )


# --- Función para actualizar una sesión concreta --- #
def update_session(db: Session, session_id: int, update_data, current_user) -> dict:
    print(f"[DEBUG] PATCH session_id: {session_id}")
    print(
        f"[DEBUG] current_user: id={getattr(current_user, 'id', None)}, role={getattr(current_user, 'role', None)}"
    )
    print(f"[DEBUG] update_data: {update_data}")
    """Permite al entrenador o admin ajustar manualmente una sesión concreta.

    Solo se actualizan los campos enviados (PATCH parcial).
    Los trainers solo pueden modificar sus propias sesiones.
    Los admins pueden modificar cualquier sesión.
    """
    # Verificar que la sesión existe
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión no encontrada",
        )

    if is_past_session_datetime(session.start_time):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=PAST_SESSION_UPDATE_ERROR,
        )

    # Admin puede modificar cualquier sesión; trainer solo las suyas
    if current_user.role != "admin" and session.trainer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para modificar esta sesión",
        )

    # Obtener solo los campos que se quieren modificar
    patch = update_data.model_dump(exclude_unset=True, exclude_none=True)

    # Detectar si va a cambiar la hora antes de aplicar el patch
    start_time_changed = "start_time" in patch
    old_start_time = session.start_time

    patch = _prepare_patch_for_session(session, patch)

    next_start_time = patch.get("start_time", session.start_time)
    next_end_time = patch.get("end_time", session.end_time)
    next_status = patch.get("status", session.status)

    if next_status != "cancelled":
        _ensure_no_session_overlap(
            db,
            next_start_time,
            next_end_time,
            exclude_session_id=session.id,
        )

    # Aplicar los cambios al objeto ORM
    for field, value in patch.items():
        setattr(session, field, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if "no_overlap_sessions" in str(exc.orig):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No se pueden solapar horas",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Datos de sesión inválidos",
        )

    db.refresh(session)

    # Enviar notificación push si cambió la hora
    if start_time_changed:
        _notify_session_time_change(db, session, old_start_time)

    # Obtener el nombre del entrenador
    trainer = db.query(User).filter(User.id == session.trainer_id).first()
    trainer_name = trainer.name if trainer else ""

    # Construir dict compatible con SessionResponse
    # Añadir trainer_name como atributo dinámico al objeto ORM
    trainer = db.query(User).filter(User.id == session.trainer_id).first()
    setattr(session, "trainer_name", trainer.name if trainer else "")
    return session


# --- Función para actualizar en bloque sesiones de una semana --- #
def update_sessions_in_week(
    db: Session,
    trainer_id: int,
    week_start_date: date,
    update_data,
) -> list[SessionModel]:
    """Actualiza en bloque las sesiones de un entrenador dentro de una ventana de 7 días."""
    patch = update_data.model_dump(exclude_unset=True, exclude_none=True)
    patch.pop("week_start_date", None)

    if not patch:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Debes enviar al menos un campo para actualizar",
        )

    week_start = datetime.combine(week_start_date, time.min, tzinfo=LOCAL_TIMEZONE)
    week_end = week_start + timedelta(days=7)

    sessions = (
        db.query(SessionModel)
        .filter(SessionModel.trainer_id == trainer_id)
        .filter(SessionModel.start_time >= week_start)
        .filter(SessionModel.start_time < week_end)
        .all()
    )

    if not sessions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay sesiones para ese entrenador en la semana indicada",
        )

    if any(is_past_session_datetime(session.start_time) for session in sessions):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=PAST_SESSION_UPDATE_ERROR,
        )

    for session in sessions:
        prepared_patch = _prepare_patch_for_session(session, patch)
        for field, value in prepared_patch.items():
            setattr(session, field, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if "no_overlap_sessions" in str(exc.orig):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La actualización semanal provoca solape con otras sesiones no canceladas del mismo entrenador",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Datos de sesión inválidos",
        )

    for session in sessions:
        db.refresh(session)

    return sessions


# --- Función para crear sesiones recurrentes de forma transaccional --- #
def create_recurring_sessions(
    db: Session, create_data_list, current_user: User
) -> list[SessionModel]:
    """
    Crea múltiples sesiones (recurrentes) de forma transaccional.
    Si alguna sesión falla (solape, integridad, etc.), se hace rollback de todas.
    - create_data_list: lista de objetos tipo SessionCreate (Pydantic o similar)
    - current_user: usuario autenticado (admin o trainer)
    Devuelve la lista de sesiones creadas.
    """
    if current_user.role not in ("trainer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo entrenadores o administradores pueden crear sesiones",
        )

    new_sessions = []
    trainer_id = None
    try:
        # Validar y preparar todas las sesiones antes de insertar
        for create_data in create_data_list:
            # Determinar trainer_id
            if (
                current_user.role == "admin"
                and getattr(create_data, "trainer_id", None) is not None
            ):
                trainer_id = create_data.trainer_id
                trainer = db.query(User).filter(User.id == trainer_id).first()
                if not trainer:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Usuario/entrenador con id {trainer_id} no encontrado",
                    )
            else:
                trainer_id = current_user.id

            # Normalizar horas a local
            start_local_time = _to_local_naive_time(create_data.start_time)
            end_local_time = _to_local_naive_time(create_data.end_time)
            session_timezone = LOCAL_TIMEZONE
            start_dt = datetime.combine(
                create_data.session_date,
                start_local_time,
                tzinfo=session_timezone,
            )
            end_dt = datetime.combine(
                create_data.session_date,
                end_local_time,
                tzinfo=session_timezone,
            )

            # Validar solape global (con otras sesiones activas)
            _ensure_no_session_overlap(db, start_dt, end_dt)

            # Validar coherencia de horas
            if start_dt >= end_dt:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="start_time debe ser anterior a end_time",
                )

            new_session = SessionModel(
                trainer_id=trainer_id,
                start_time=start_dt,
                end_time=end_dt,
                capacity=create_data.capacity,
                class_name=create_data.class_name,
                notes=getattr(create_data, "notes", None) or None,
                status="active",
            )
            new_sessions.append(new_session)

        # Si todas las validaciones pasan, insertar todas en bloque
        for session in new_sessions:
            db.add(session)
        db.commit()
        for session in new_sessions:
            db.refresh(session)
        # Añadir trainer_name dinámicamente
        trainer = db.query(User).filter(User.id == trainer_id).first()
        for session in new_sessions:
            setattr(session, "trainer_name", trainer.name if trainer else "")
        return new_sessions
    except IntegrityError as exc:
        db.rollback()
        if "no_overlap_sessions" in str(exc.orig):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Alguna sesión se solapa con otra no cancelada del mismo entrenador",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Datos de sesión inválidos",
        )
    except Exception:
        db.rollback()
        raise


# --- Función para copiar sesiones de una semana a otra --- #
def copy_week_sessions(
    db: Session, source_week_start: date, target_week_start: date, trainer_id: int | None = None
) -> list[SessionModel]:
    """
    Copia todas las sesiones (status 'active' o 'completed', nunca 'cancelled') de una semana a otra.
    Si trainer_id es None, copia todas las sesiones de todos los entrenadores.
    Si trainer_id está presente, solo copia las de ese entrenador.
    """
    session_timezone = LOCAL_TIMEZONE
    # Calcular rango de fechas origen y destino
    source_start_dt = datetime.combine(
        source_week_start, time.min, tzinfo=session_timezone
    )
    source_end_dt = source_start_dt + timedelta(days=7)
    target_start_dt = datetime.combine(
        target_week_start, time.min, tzinfo=session_timezone
    )
    # Buscar sesiones en la semana origen
    query = db.query(SessionModel).filter(SessionModel.status.in_(["active", "completed"]))
    if trainer_id is not None:
        query = query.filter(SessionModel.trainer_id == trainer_id)
    query = query.filter(SessionModel.start_time >= source_start_dt)
    query = query.filter(SessionModel.start_time < source_end_dt)
    sessions_to_copy = query.all()
    if not sessions_to_copy:
        raise HTTPException(
            status_code=404,
            detail="No hay clases en la semana seleccionada",
        )
    new_sessions = []
    try:
        for session in sessions_to_copy:
            # Calcular el desfase de días entre origen y destino
            day_offset = (session.start_time.date() - source_week_start).days
            new_date = target_week_start + timedelta(days=day_offset)
            # Mantener horas locales
            start_local = (
                session.start_time.astimezone(session_timezone)
                .timetz()
                .replace(tzinfo=None)
            )
            end_local = (
                session.end_time.astimezone(session_timezone)
                .timetz()
                .replace(tzinfo=None)
            )
            new_start_dt = datetime.combine(
                new_date, start_local, tzinfo=session_timezone
            )
            new_end_dt = datetime.combine(new_date, end_local, tzinfo=session_timezone)
            _ensure_no_session_overlap(db, new_start_dt, new_end_dt)
            new_session = SessionModel(
                trainer_id=session.trainer_id,
                start_time=new_start_dt,
                end_time=new_end_dt,
                capacity=session.capacity,
                class_name=session.class_name,
                notes=session.notes,
                status="active",
            )
            new_sessions.append(new_session)
        for s in new_sessions:
            db.add(s)
        db.commit()
        for s in new_sessions:
            db.refresh(s)
        # Añadir trainer_name dinámicamente
        for s in new_sessions:
            trainer = db.query(User).filter(User.id == s.trainer_id).first()
            setattr(s, "trainer_name", trainer.name if trainer else "")
        return new_sessions
    except IntegrityError as exc:
        db.rollback()
        if "no_overlap_sessions" in str(exc.orig):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Alguna sesión copiada se solapa con otra existente en la semana destino",
            )
        raise HTTPException(
            status_code=500,
            detail="Error inesperado al copiar sesiones",
        )
