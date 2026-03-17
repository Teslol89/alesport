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
    def validate_times(self):
        for field_name, t in (("start_time", self.start_time), ("end_time", self.end_time)):
            if t.second != 0 or t.minute not in (0, 30):
                raise ValueError(f"{field_name} must be on the hour or half hour (e.g. 18:00 or 18:30)")
        if self.start_time >= self.end_time:
            raise ValueError("start_time must be earlier than end_time")
        return self
