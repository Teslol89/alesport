from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.weekly_schedule import WeeklySchedule


def get_weekly_schedule(db: Session):
    """Returns the weekly schedule for all trainers."""
    return db.query(WeeklySchedule).all()


def create_weekly_schedule(db: Session, schedule_data):
    """Creates a new weekly schedule entry."""
    trainer = (
        db.query(User)
        .filter(
            User.id == schedule_data.trainer_id,
            User.role == "trainer",
            User.is_active.is_(True),
        )
        .first()
    )
    if trainer is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="trainer_id must belong to an active trainer",
        )

    schedule = WeeklySchedule(**schedule_data.model_dump())
    db.add(schedule)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        error_message = str(exc.orig)
        if "no_overlap_schedule" in error_message:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Schedule overlaps an existing active slot for this trainer and day",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid schedule data",
        )
    db.refresh(schedule)
    return schedule
