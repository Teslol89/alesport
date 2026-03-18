from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.schemas.session import SessionResponse, SessionUpdate
from app.services.session_service import get_sessions, update_session

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("/", response_model=list[SessionResponse])
def read_sessions(db: Session = Depends(get_db)):
    """Devuelve todas las sesiones registradas."""
    return get_sessions(db)


@router.patch("/{session_id}", response_model=SessionResponse)
def patch_session(session_id: int, update_data: SessionUpdate, db: Session = Depends(get_db)):
    """Permite al entrenador ajustar manualmente una sesion concreta (PATCH parcial)."""
    return update_session(db, session_id, update_data)
