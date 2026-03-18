from datetime import timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.session import SessionModel


def get_sessions(db: Session) -> list[SessionModel]:
    """Devuelve todas las sesiones registradas en la base de datos."""
    return db.query(SessionModel).all()


def update_session(db: Session, session_id: int, update_data) -> SessionModel:
    """Permite al entrenador ajustar manualmente una sesion concreta.

    Solo se actualizan los campos enviados (PATCH parcial).
    """
    # Verificar que la sesion existe
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesion no encontrada",
        )

    # Obtener solo los campos que se quieren modificar
    patch = update_data.model_dump(exclude_unset=True)

    # Validar coherencia temporal si se modifican los horarios
    if "start_time" in patch or "end_time" in patch:
        start = patch.get("start_time", session.start_time)
        end = patch.get("end_time", session.end_time)

        # Normalizar a UTC para comparación segura entre datetimes con y sin zona horaria
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)

        if start >= end:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="start_time debe ser anterior a end_time",
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
                detail="La sesion actualizada se solapa con otra sesion activa del mismo entrenador",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Datos de sesion inválidos",
        )

    db.refresh(session)
    return session
