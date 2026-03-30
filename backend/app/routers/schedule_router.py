from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.security import get_current_user
from app.database.db import get_db
from app.models.user import User
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

# Rutas para gestionar horarios semanales y generación de sesiones a partir de ellos. Solo accesibles por admins.
router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("/", response_model=list[WeeklyScheduleResponse])
def read_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve todos los horarios semanales registrados."""
    return get_weekly_schedule(db)


@router.post("/", response_model=WeeklyScheduleResponse)
def create_schedule(
    schedule: WeeklyScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crea un nuevo horario semanal y genera automáticamente las sesiones futuras.
    Solo el administrador puede crear horarios (trainer_id se especifica en el body).
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el administrador puede crear horarios semanales",
        )
    return create_weekly_schedule(db, schedule)


@router.post("/generate-sessions", response_model=SessionGenerationResponse)
def generate_sessions(
    generation_data: SessionGenerationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Genera sesiones futuras manualmente a partir de los horarios semanales activos."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden generar sesiones manualmente",
        )
    return generate_sessions_from_schedule(db, generation_data)
