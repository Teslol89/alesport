from sqlalchemy.orm import Session

from app.models.user import User
<<<<<<< HEAD
=======
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
    deep_link = f"alesport://verify-email?token={token}"
    # Email HTML con botón y fallback de texto
    html_body = f"""
<html>
<body>
<p>Hola,</p>
<p>Gracias por registrarte en Alesport. Para activar tu cuenta, pulsa el siguiente botón desde tu móvil:</p>
<p style='text-align:center;margin:32px 0;'>
  <a href="{deep_link}" style="background:#2dd36f;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:18px;display:inline-block;">Abrir en la app</a>
</p>
<p>Si el botón no funciona, copia y pega este enlace en tu navegador móvil:</p>
<p style='word-break:break-all;font-family:monospace;font-size:15px'>{deep_link}</p>
<p>Si no has solicitado esta cuenta, ignora este correo.</p>
<p>Un saludo,<br>El equipo de Alesport</p>
</body>
</html>
"""
    # También añade versión solo texto por compatibilidad
    text_body = f"""
Hola,

Gracias por registrarte en Alesport. Para activar tu cuenta, abre este enlace desde tu móvil:

{deep_link}

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
    print(f"[LOG] Enlace de verificación: {deep_link}")
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
>>>>>>> 97e5553bde3fd4007ae7d7c334535f62557f807f


def get_all_users(db: Session) -> list[User]:
    """Devuelve todos los usuarios registrados en la base de datos."""
    return db.query(User).all()
