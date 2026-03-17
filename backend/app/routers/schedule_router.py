from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.schemas.weekly_schedule import WeeklyScheduleResponse, WeeklyScheduleCreate
from app.services.schedule_service import get_weekly_schedule, create_weekly_schedule

router = APIRouter(prefix="/schedule", tags=["schedule"])


# 🔹 GET (read schedule)
@router.get("/", response_model=list[WeeklyScheduleResponse])
def read_schedule(db: Session = Depends(get_db)):
    """Returns the weekly schedule for all trainers."""
    return get_weekly_schedule(db)


# 🔹 POST (create schedule)
@router.post("/", response_model=WeeklyScheduleResponse)
def create_schedule(schedule: WeeklyScheduleCreate, db: Session = Depends(get_db)):
    """Creates a new weekly schedule entry."""
    return create_weekly_schedule(db, schedule)
