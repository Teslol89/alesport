from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
import os
from app.database.db import get_db
from app.models.user import User

# Cargar configuración de JWT desde variables de entorno
jwt_secret_key = os.getenv("JWT_SECRET_KEY")
if not jwt_secret_key:
    raise ValueError("JWT_SECRET_KEY no está configurada en las variables de entorno")

JWT_SECRET_KEY: str = jwt_secret_key
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Funciones de seguridad ─────────────────────────────────────────────────────
# Estas funciones se encargan de hashear contraseñas y verificar hashes, utilizando bcrypt a través de PassLib.
def hash_password(plain: str) -> str:
    """Hashea una contraseña en texto plano usando bcrypt.
    Se usa al crear usuarios o cambiar contraseñas."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verifica que una contraseña en texto plano coincida con su hash.
    Se usa al autenticar usuarios (Login)."""
    try:
        return pwd_context.verify(plain, hashed)
    except UnknownHashError:
        return False


def create_access_token(data: dict) -> str:
    """Crea un token JWT con la carga útil proporcionada y una fecha de expiración."""
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


# El esquema de seguridad OAuth2PasswordBearer se utiliza para extraer el token JWT de las solicitudes entrantes.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta desactivada"
        )

    return user
