from pydantic import BaseModel, Field, model_validator
from datetime import time, datetime


# 🔹 RESPONSE (read dates)
class WeeklyScheduleResponse(BaseModel):
    id: int
    trainer_id: int
    day_of_week: int
    start_time: time
    end_time: time
    capacity: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
    
# 🔹 POST (create dates)
class WeeklyScheduleCreate(BaseModel):
    trainer_id: int = Field(gt=0)
    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    capacity: int = Field(gt=0, le=10)

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.start_time >= self.end_time:
            raise ValueError("start_time must be earlier than end_time")
        return self
