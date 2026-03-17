from pydantic import BaseModel


class UserResponse(BaseModel):
    """Fields returned to the client. Sensitive fields (password_hash, etc.) are intentionally excluded."""

    id: int
    name: str
    email: str
    role: str
    is_active: bool
    membership_active: bool

    # Allows Pydantic to read data from SQLAlchemy ORM objects directly.
    model_config = {"from_attributes": True}
