from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.schemas.user import UserResponse
from app.services.user_service import get_all_users

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserResponse])
def get_users(db: Session = Depends(get_db)):
    """Devuelve todos los usuarios registrados."""
    return get_all_users(db)
