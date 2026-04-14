from __future__ import annotations

import json
import importlib
import secrets
import time
from threading import Lock
from typing import Any

from app.config import settings
from app.models.user import User

Redis = Any
_redis_module: Any | None = None
try:
    _redis_module = importlib.import_module("redis")
except Exception:  # pragma: no cover - optional runtime dependency
    _redis_module = None


WS_TICKET_TTL_SECONDS = 30
WS_TICKET_PREFIX = "alesport:ws-ticket:"


class RealtimeTicketService:
    def __init__(self) -> None:
        self._lock = Lock()
        self._local_tickets: dict[str, tuple[float, dict[str, str | int]]] = {}
        self._redis_client: Redis | None = None  # type: ignore[type-arg]

    def _get_redis_client(self) -> Redis | None:  # type: ignore[type-arg]
        if not settings.REDIS_URL or _redis_module is None:
            return None
        if self._redis_client is None:
            self._redis_client = _redis_module.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis_client

    def issue_ticket(self, user: User) -> str:
        ticket = secrets.token_urlsafe(36)
        payload = {
            "user_id": int(user.id),
            "role": str(user.role),
            "email": str(user.email),
        }

        redis_client = self._get_redis_client()
        if redis_client is not None:
            redis_client.setex(f"{WS_TICKET_PREFIX}{ticket}", WS_TICKET_TTL_SECONDS, json.dumps(payload))
            return ticket

        expires_at = time.time() + WS_TICKET_TTL_SECONDS
        with self._lock:
            self._local_tickets[ticket] = (expires_at, payload)
        return ticket

    def consume_ticket(self, ticket: str) -> dict[str, str | int] | None:
        redis_client = self._get_redis_client()
        if redis_client is not None:
            key = f"{WS_TICKET_PREFIX}{ticket}"
            raw_payload = redis_client.execute_command("GETDEL", key)
            if not raw_payload:
                return None
            try:
                parsed = json.loads(raw_payload)
            except Exception:
                return None
            return parsed if isinstance(parsed, dict) else None

        with self._lock:
            # Limpieza de tickets expirados en cada consumo local.
            now = time.time()
            expired = [value for value, (expires_at, _) in self._local_tickets.items() if expires_at <= now]
            for value in expired:
                self._local_tickets.pop(value, None)

            stored = self._local_tickets.pop(ticket, None)

        if stored is None:
            return None

        expires_at, payload = stored
        if expires_at <= time.time():
            return None
        return payload


realtime_ticket_service = RealtimeTicketService()
