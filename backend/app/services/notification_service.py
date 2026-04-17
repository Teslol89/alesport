"""Servicio de notificaciones push via Firebase Cloud Messaging (FCM).

Requiere:
- firebase-admin en requirements.txt
- Variable de entorno FIREBASE_CREDENTIALS_JSON con el JSON de la service account
  (o la ruta al fichero en FIREBASE_CREDENTIALS_PATH)
"""

import json
import logging
import os
from pathlib import Path
from typing import Optional
import firebase_admin
from firebase_admin import credentials


logger = logging.getLogger(__name__)

_firebase_initialized = False


def _resolve_credentials_path() -> Optional[Path]:
    """Resuelve la ruta del JSON de Firebase por variable de entorno o autodetección."""
    backend_root = Path(__file__).resolve().parents[2]
    project_root = Path(__file__).resolve().parents[3]

    env_value = os.environ.get("FIREBASE_CREDENTIALS_PATH")
    if env_value:
        raw = Path(env_value).expanduser()
        candidates = [raw]
        if not raw.is_absolute():
            candidates.append(backend_root / raw)
            candidates.append(project_root / raw)

        for candidate in candidates:
            if candidate.exists():
                return candidate

    for base in (backend_root, project_root):
        matches = sorted(base.glob("*firebase-adminsdk*.json"))
        if matches:
            return matches[0]

    return None


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
            credentials_path = _resolve_credentials_path()
            if credentials_path is not None:
                cred = credentials.Certificate(str(credentials_path))

        if cred is None:
            return False
            return False

        firebase_admin.initialize_app(cred)
        _firebase_initialized = True
        # ...existing code...
        return True

    except ImportError:
        return False
        return False
    except Exception as e:
        return False
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

        android_config = messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(
                channel_id="alesport_alerts",
                sound="default",
                icon="ic_stat_alesport",
            ),
        )

        apns_config = messaging.APNSConfig(
            headers={"apns-priority": "10"},
            payload=messaging.APNSPayload(
                aps=messaging.Aps(sound="default"),
            ),
        )

        messages = [
            messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                data={k: str(v) for k, v in (data or {}).items()},
                android=android_config,
                apns=apns_config,
                token=token,
            )
            for token in tokens
            if token
        ]

        if not messages:
            return

        response = messaging.send_each(messages)
        # ...existing code...

    except Exception as e:
        # ...existing code...
        pass
