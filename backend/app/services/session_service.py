from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.session import SessionModel
from app.models.user import User
import logging

from app.utils.utils import get_logger

LOCAL_TIMEZONE = ZoneInfo("Europe/Madrid")
logger = get_logger(__name__)


def _prepare_patch_for_session(session: SessionModel, patch: dict) -> dict:
    """Convierte patch de time->datetime y valida coherencia start/end para una sesión."""
    prepared_patch = dict(patch)
    session_timezone = session.start_time.tzinfo or LOCAL_TIMEZONE

    if (
        "start_time" in prepared_patch
        and hasattr(prepared_patch["start_time"], "hour")
        and not hasattr(prepared_patch["start_time"], "date")
    ):
        session_date = session.start_time.date()
        prepared_patch["start_time"] = datetime.combine(
            session_date,
            prepared_patch["start_time"],
            tzinfo=session_timezone,
        )

    if (
        "end_time" in prepared_patch
        and hasattr(prepared_patch["end_time"], "hour")
        and not hasattr(prepared_patch["end_time"], "date")
    ):
        session_date = session.start_time.date()
        prepared_patch["end_time"] = datetime.combine(
            session_date,
            prepared_patch["end_time"],
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

    # Admin puede modificar cualquier sesión; trainer solo las suyas
    if current_user.role != "admin" and session.trainer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para modificar esta sesion",
        )

    # Obtener solo los campos que se quieren modificar
    patch = update_data.model_dump(exclude_unset=True, exclude_none=True)
    patch = _prepare_patch_for_session(session, patch)

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
                detail="La sesion actualizada se solapa con otra sesion activa del mismo entrenador",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Datos de sesion inválidos",
        )

    db.refresh(session)
    # Añadir trainer_name como atributo dinámico al objeto ORM
    trainer = db.query(User).filter(User.id == session.trainer_id).first()
    setattr(session, "trainer_name", trainer.name if trainer else "")
    return session


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
                detail="La actualización semanal provoca solape con otras sesiones activas del mismo entrenador",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Datos de sesion inválidos",
        )

    for session in sessions:
        db.refresh(session)

    return sessions
