from datetime import datetime

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import Boolean, Integer, TIMESTAMP

from app.database.db import Base


class WeeklyScheduleStudent(Base):
    """Relación entre un horario recurrente y sus alumnos fijos."""

    __tablename__ = "weekly_schedule_students"
    __table_args__ = (
        UniqueConstraint(
            "weekly_schedule_id",
            "user_id",
            name="uq_weekly_schedule_student",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    weekly_schedule_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("weekly_schedule.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
