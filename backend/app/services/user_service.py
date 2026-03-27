# --- SERVICIOS DE USUARIOS ---
# Estos servicios encapsulan la lógica de negocio relacionada con los usuarios,
# como la creación de nuevos usuarios, la recuperación de usuarios por email o ID,
# y la actualización de información del usuario. Al centralizar esta lógica en un servicio,
# se facilita el mantenimiento y la reutilización del código en diferentes partes de la
# aplicación (routers, otros servicios, etc.).

from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from app.auth.security import hash_password
from sqlalchemy.exc import IntegrityError


# --- OBTENER USUARIOS ---
def get_all_users(db: Session) -> list[User]:
    """Devuelve todos los usuarios registrados en la base de datos."""
    return db.query(User).all()


# --- CREAR USUARIO NUEVO ---
def create_user(db: Session, user_in: UserCreate) -> User:
    """Crea un usuario nuevo con contraseña hasheada. Lanza excepción si el email ya existe."""
    if db.query(User).filter(User.email == user_in.email).first():
        raise ValueError("El email ya está registrado")
    user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        role="client",
        is_active=True,
        membership_active=True,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise ValueError("Error de integridad al crear usuario")
    return user
