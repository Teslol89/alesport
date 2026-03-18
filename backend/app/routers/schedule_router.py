from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.schemas.weekly_schedule import (
    SessionGenerationRequest,
    SessionGenerationResponse,
    WeeklyScheduleCreate,
    WeeklyScheduleResponse,
)
from app.services.schedule_service import (
    create_weekly_schedule,
    generate_sessions_from_schedule,
    get_weekly_schedule,
)

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("/", response_model=list[WeeklyScheduleResponse])
def read_schedule(db: Session = Depends(get_db)):
    """Devuelve todos los horarios semanales registrados."""
    return get_weekly_schedule(db)


@router.post("/", response_model=WeeklyScheduleResponse)
def create_schedule(schedule: WeeklyScheduleCreate, db: Session = Depends(get_db)):
    """Crea un nuevo horario semanal y genera automáticamente las sesiones futuras."""
    return create_weekly_schedule(db, schedule)


@router.post("/generate-sessions", response_model=SessionGenerationResponse)
def generate_sessions(
    generation_data: SessionGenerationRequest,
    db: Session = Depends(get_db),
):
    """Genera sesiones futuras manualmente a partir de los horarios semanales activos."""
    return generate_sessions_from_schedule(db, generation_data)
