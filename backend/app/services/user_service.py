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

# Envío de emails de verificación y recuperación de contraseña
async def send_password_reset_email(email: str, code: str):
    subject = "Recupera tu contraseña en Alesport"
    html_body = f"""
<html>
<body>
<p>Hola,</p>
<p>Has solicitado restablecer tu contraseña en Alesport. Introduce el siguiente código en la app para continuar:</p>
<div style='text-align:center;margin:32px 0;'>
    <span style="background:#0089a6;color:#fff;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:28px;letter-spacing:4px;display:inline-block;">{code}</span>
</div>
<p>Si no has solicitado este cambio, ignora este correo.</p>
<p>Un saludo,<br>El equipo de Alesport</p>
</body>
</html>
"""
    text_body = f"""
Hola,

Has solicitado restablecer tu contraseña en Alesport. Introduce este código en la app para continuar:

{code}

Si no has solicitado este cambio, ignora este correo.

Un saludo,
El equipo de Alesport
"""
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = email
    msg["Subject"] = subject
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    print(f"[LOG] Intentando enviar email de recuperación a: {email}")
    try:
        result = await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        print(f"[LOG] Email de recuperación enviado correctamente. Respuesta SMTP: {result}")
    except Exception as e:
        print(f"[ERROR] Fallo al enviar email de recuperación: {e}")

# Envío de email de verificación al registrar un nuevo usuario
async def send_verification_email(email: str, code: str):
    subject = "Tu código de verificación para Alesport"
    html_body = f"""
<html>
<body>
<p>Hola,</p>
<p>Gracias por registrarte en Alesport. Para activar tu cuenta, introduce el siguiente código en la app:</p>
<div style='text-align:center;margin:32px 0;'>
    <span style="background:#2dd36f;color:#fff;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:28px;letter-spacing:4px;display:inline-block;">{code}</span>
</div>
<p>Si no has solicitado esta cuenta, ignora este correo.</p>
<p>Un saludo,<br>El equipo de Alesport</p>
</body>
</html>
"""
    text_body = f"""
Hola,

Gracias por registrarte en Alesport. Para activar tu cuenta, introduce este código en la app:

{code}

Si no has solicitado esta cuenta, ignora este correo.

Un saludo,
El equipo de Alesport
"""
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = email
    msg["Subject"] = subject
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    print(f"[LOG] Intentando enviar email de verificación a: {email}")
    print(f"[LOG] SMTP_HOST: {settings.SMTP_HOST}, SMTP_PORT: {settings.SMTP_PORT}, SMTP_USER: {settings.SMTP_USER}, SMTP_FROM: {settings.SMTP_FROM}")
    print(f"[LOG] Código de verificación: {code}")
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
    import string
    code_charset = string.ascii_uppercase + string.digits
    verification_code = ''.join(secrets.choice(code_charset) for _ in range(6))
    user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        role="client",
        is_active=True,
        membership_active=True,
        is_verified=False,
        verification_code=verification_code,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
        print(f"[LOG] Usuario creado correctamente en la base de datos: {user.email}")
        await send_verification_email(user.email, verification_code)
    except IntegrityError as e:
        db.rollback()
        print(f"[ERROR] Error de integridad al crear usuario: {e}")
        raise ValueError("Error de integridad al crear usuario")
    return user
