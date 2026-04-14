from __future__ import annotations

import itertools
import json
from queue import Empty, Queue
from threading import Event, Lock, Thread
from typing import Any, Protocol

from app.config import settings

try:
    from redis import Redis
except Exception:  # pragma: no cover - optional dependency at runtime
    Redis = None  # type: ignore[assignment]


REDIS_CHANNEL = "alesport:realtime"


class RealtimeSubscription(Protocol):
    def get(self, timeout: float | None = None) -> dict[str, Any] | None:
        ...

    def close(self) -> None:
        ...


class LocalSubscription:
    def __init__(self, bus: "RealtimeEventBus", subscriber_id: int, queue: Queue[dict[str, Any]]) -> None:
        self._bus = bus
        self._subscriber_id = subscriber_id
        self._queue = queue

    def get(self, timeout: float | None = None) -> dict[str, Any] | None:
        try:
            return self._queue.get(timeout=timeout)
        except Empty:
            return None

    def close(self) -> None:
        self._bus._unsubscribe_local(self._subscriber_id)


class RedisSubscription:
    def __init__(self, redis_client: Redis) -> None:  # type: ignore[type-arg]
        self._queue: Queue[dict[str, Any]] = Queue()
        self._stop_event = Event()
        self._pubsub = redis_client.pubsub(ignore_subscribe_messages=True)
        self._pubsub.subscribe(REDIS_CHANNEL)
        self._thread = Thread(target=self._listen, daemon=True)
        self._thread.start()

    def _listen(self) -> None:
        try:
            for message in self._pubsub.listen():
                if self._stop_event.is_set():
                    break
                if not message or message.get("type") != "message":
                    continue
                raw_data = message.get("data")
                if raw_data is None:
                    continue
                if isinstance(raw_data, bytes):
                    raw_data = raw_data.decode("utf-8")
                try:
                    payload = json.loads(raw_data)
                except Exception:
                    continue
                if isinstance(payload, dict):
                    self._queue.put(payload)
        finally:
            try:
                self._pubsub.close()
            except Exception:
                pass

    def get(self, timeout: float | None = None) -> dict[str, Any] | None:
        try:
            return self._queue.get(timeout=timeout)
        except Empty:
            return None

    def close(self) -> None:
        self._stop_event.set()
        try:
            self._pubsub.unsubscribe(REDIS_CHANNEL)
        except Exception:
            pass
        try:
            self._pubsub.close()
        except Exception:
            pass


class RealtimeEventBus:
    def __init__(self) -> None:
        self._lock = Lock()
        self._next_id = itertools.count(1)
        self._subscribers: dict[int, Queue[dict[str, Any]]] = {}
        self._redis_client: Redis | None = None  # type: ignore[type-arg]

    def _get_redis_client(self) -> Redis | None:  # type: ignore[type-arg]
        if not settings.REDIS_URL or Redis is None:
            return None
        if self._redis_client is None:
            self._redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=False)
        return self._redis_client

    def subscribe(self) -> RealtimeSubscription:
        redis_client = self._get_redis_client()
        if redis_client is not None:
            return RedisSubscription(redis_client)

        queue: Queue[dict[str, Any]] = Queue()
        subscriber_id = next(self._next_id)
        with self._lock:
            self._subscribers[subscriber_id] = queue
        return LocalSubscription(self, subscriber_id, queue)

    def _unsubscribe_local(self, subscriber_id: int) -> None:
        with self._lock:
            self._subscribers.pop(subscriber_id, None)

    def publish(self, event: dict[str, Any]) -> None:
        redis_client = self._get_redis_client()
        if redis_client is not None:
            try:
                redis_client.publish(REDIS_CHANNEL, json.dumps(event))
                return
            except Exception:
                # Si Redis falla temporalmente, caemos al bus local.
                pass

        with self._lock:
            subscribers = list(self._subscribers.values())

        for subscriber_queue in subscribers:
            subscriber_queue.put(event)


realtime_event_bus = RealtimeEventBus()


def publish_booking_change(session_id: int, action: str) -> None:
    realtime_event_bus.publish(
        {
            "type": "booking_changed",
            "session_id": session_id,
            "action": action,
        }
    )


def publish_user_profile_change(user_id: int, action: str = "updated") -> None:
    realtime_event_bus.publish(
        {
            "type": "user_profile_changed",
            "user_id": user_id,
            "action": action,
        }
    )
