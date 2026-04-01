"""Servicio de notificaciones push via Firebase Cloud Messaging (FCM).

Requiere:
- firebase-admin en requirements.txt
- Variable de entorno FIREBASE_CREDENTIALS_JSON con el JSON de la service account
  (o la ruta al fichero en FIREBASE_CREDENTIALS_PATH)
"""

import json
import logging
import os
from typing import Optional
import firebase_admin
from firebase_admin import credentials


logger = logging.getLogger(__name__)

_firebase_initialized = False


def _init_firebase() -> bool:
    """Inicializa el SDK de Firebase Admin si no está ya inicializado.
    Devuelve True si la inicialización tuvo éxito, False si no hay credenciales configuradas.
    """
    global _firebase_initialized
    if _firebase_initialized:
        return True

    try:
        # Evitar doble inicialización si ya hay una app
        if firebase_admin._apps:
            _firebase_initialized = True
            return True

        cred = None

        # Opción 1: JSON completo como variable de entorno
        credentials_json = os.environ.get("FIREBASE_CREDENTIALS_JSON")
        if credentials_json:
            cred_dict = json.loads(credentials_json)
            cred = credentials.Certificate(cred_dict)

        # Opción 2: Ruta a fichero JSON
        if cred is None:
            credentials_path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
            if credentials_path and os.path.exists(credentials_path):
                cred = credentials.Certificate(credentials_path)

        if cred is None:
            logger.warning(
                "FCM no configurado: define FIREBASE_CREDENTIALS_JSON o FIREBASE_CREDENTIALS_PATH"
            )
            return False

        firebase_admin.initialize_app(cred)
        _firebase_initialized = True
        logger.info("Firebase Admin SDK inicializado correctamente")
        return True

    except ImportError:
        logger.warning(
            "firebase-admin no está instalado. Las notificaciones push no funcionarán."
        )
        return False
    except Exception as e:
        logger.error(f"Error inicializando Firebase: {e}")
        return False


def send_push_notification(
    tokens: list[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> None:
    """Envía una notificación push a una lista de tokens FCM.

    Silencia errores para no bloquear el flujo principal si FCM falla.
    Los tokens inválidos se ignoran automáticamente.
    """
    if not tokens:
        return

    if not _init_firebase():
        return

    try:
        from firebase_admin import messaging

        messages = [
            messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                data={k: str(v) for k, v in (data or {}).items()},
                token=token,
            )
            for token in tokens
            if token
        ]

        if not messages:
            return

        response = messaging.send_each(messages)
        logger.info(
            f"Push enviado: {response.success_count} ok, {response.failure_count} fallidos"
        )

    except Exception as e:
        logger.error(f"Error enviando notificaciones FCM: {e}")
