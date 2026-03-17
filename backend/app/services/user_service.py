from sqlalchemy.orm import Session
from app.models.user import User


def get_all_users(db: Session):
    """Returns all registered users."""
    return db.query(User).all()
