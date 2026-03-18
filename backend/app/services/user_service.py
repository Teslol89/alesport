from sqlalchemy.orm import Session

from app.models.user import User


def get_all_users(db: Session) -> list[User]:
    """Devuelve todos los usuarios registrados en la base de datos."""
    return db.query(User).all()
