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
import secrets
import aiosmtplib
from email.message import EmailMessage
from app.config import settings

# Envío real de email de verificación
import asyncio

async def send_verification_email(email: str, token: str):
    subject = "Verifica tu cuenta en Alesport"
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    body = f"""
Hola,

Gracias por registrarte en Alesport. Para activar tu cuenta, haz clic en el siguiente enlace:

{verify_url}

Si no has solicitado esta cuenta, ignora este correo.

Un saludo,
El equipo de Alesport
"""
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = email
    msg["Subject"] = subject
    msg.set_content(body)

    print(f"[LOG] Intentando enviar email de verificación a: {email}")
    print(f"[LOG] SMTP_HOST: {settings.SMTP_HOST}, SMTP_PORT: {settings.SMTP_PORT}, SMTP_USER: {settings.SMTP_USER}, SMTP_FROM: {settings.SMTP_FROM}")
    print(f"[LOG] Enlace de verificación: {verify_url}")
    try:
        result = await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        print(f"[LOG] Email enviado correctamente. Respuesta SMTP: {result}")
    except Exception as e:
        print(f"[ERROR] Fallo al enviar email de verificación: {e}")


# --- OBTENER USUARIOS ---
def get_all_users(db: Session) -> list[User]:
    """Devuelve todos los usuarios registrados en la base de datos."""
    return db.query(User).all()


# --- CREAR USUARIO NUEVO ---
async def create_user(db: Session, user_in: UserCreate) -> User:
    """Crea un usuario nuevo con contraseña hasheada y verificación de email. Lanza excepción si el email ya existe."""
    if db.query(User).filter(User.email == user_in.email).first():
        print(f"[LOG] Registro fallido: el email {user_in.email} ya está registrado.")
        raise ValueError("El email ya está registrado")
    verification_token = secrets.token_urlsafe(32)
    user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        role="client",
        is_active=True,
        membership_active=True,
        is_verified=False,
        verification_token=verification_token,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
        print(f"[LOG] Usuario creado correctamente en la base de datos: {user.email}")
        await send_verification_email(user.email, verification_token)
    except IntegrityError as e:
        db.rollback()
        print(f"[ERROR] Error de integridad al crear usuario: {e}")
        raise ValueError("Error de integridad al crear usuario")
    return user
