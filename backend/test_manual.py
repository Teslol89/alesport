import os
from datetime import datetime

import requests


BASE_URL = os.getenv("API_BASE_URL", "https://www.verdeguerlabs.es/api")
USERS = [
    {"email": "admin@demo.com", "password": "admin123", "role": "admin"},
    {"email": "trainer@demo.com", "password": "trainer123", "role": "trainer"},
    {"email": "cliente@demo.com", "password": "cliente123", "role": "client"},
]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def login(email: str, password: str) -> str | None:
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    print(f"[LOGIN ERROR] {email}: {response.status_code} {response.text}")
    return None


def request_and_check(method: str, path: str, expected: set[int], **kwargs):
    response = requests.request(method, f"{BASE_URL}{path}", timeout=20, **kwargs)
    if response.status_code not in expected:
        raise AssertionError(
            f"{method} {path} -> esperado {sorted(expected)}, recibido {response.status_code}. Body: {response.text}"
        )
    return response


def pick_session_for_role(sessions: list[dict], role: str, user_id: int | None) -> dict | None:
    if not sessions:
        return None
    if role == "trainer" and user_id is not None:
        for session in sessions:
            if session.get("trainer_id") == user_id:
                return session
        return None
    return sessions[0]


def run_common_checks(token: str, role: str):
    headers = auth_headers(token)

    me = request_and_check("GET", "/auth/me", {200}, headers=headers).json()
    user_id = me.get("id")

    sessions_resp = request_and_check("GET", "/sessions/", {200}, headers=headers)
    sessions = sessions_resp.json() if isinstance(sessions_resp.json(), list) else []

    if role == "admin":
        request_and_check("GET", "/users/", {200}, headers=headers)
    else:
        request_and_check("GET", "/users/", {403}, headers=headers)

    request_and_check("GET", "/schedule/", {200}, headers=headers)

    if role == "admin":
        request_and_check(
            "POST",
            "/schedule/generate-sessions",
            {200, 409},
            headers=headers,
            json={"weeks_ahead": 1},
        )
    else:
        request_and_check(
            "POST",
            "/schedule/generate-sessions",
            {403},
            headers=headers,
            json={"weeks_ahead": 1},
        )

    return user_id, sessions


def run_role_specific_checks(token: str, role: str, user_id: int | None, sessions: list[dict]):
    headers = auth_headers(token)
    session = pick_session_for_role(sessions, role, user_id)

    if role in ("admin", "trainer") and session is not None:
        session_id = session["id"]
        request_and_check(
            "PATCH",
            f"/sessions/{session_id}",
            {200},
            headers=headers,
            json={"capacity": 8},
        )
        request_and_check(
            "PATCH",
            f"/sessions/{session_id}",
            {422},
            headers=headers,
            json={"capacity": 0},
        )
        request_and_check(
            "PATCH",
            f"/sessions/{session_id}",
            {422},
            headers=headers,
            json={"capacity": 20},
        )

    if role == "client":
        if session is None:
            print("[INFO] No hay sesiones para probar reservas de cliente")
            return

        booking = request_and_check(
            "POST",
            "/bookings/",
            {200, 201, 409},
            headers=headers,
            json={"session_id": session["id"]},
        )

        # Segundo intento debe devolver conflicto por reserva duplicada o reglas de negocio.
        request_and_check(
            "POST",
            "/bookings/",
            {409},
            headers=headers,
            json={"session_id": session["id"]},
        )

        if booking.status_code in (200, 201):
            booking_id = booking.json().get("id")
            if booking_id is not None:
                request_and_check(
                    "PATCH",
                    f"/bookings/{booking_id}/cancel",
                    {200},
                    headers=headers,
                )


def run_auth_guard_checks():
    request_and_check("GET", "/sessions/", {401})
    request_and_check("GET", "/sessions/", {401}, headers={"Authorization": "Bearer token-invalido"})


def run_tests_for_user(user: dict):
    print(f"\n===== TEST MANUAL {user['role'].upper()} =====")
    token = login(user["email"], user["password"])
    if token is None:
        raise AssertionError(f"No se pudo iniciar sesión para {user['email']}")

    user_id, sessions = run_common_checks(token, user["role"])
    run_role_specific_checks(token, user["role"], user_id, sessions)
    print(f"[OK] {user['role']} -> pruebas superadas")


if __name__ == "__main__":
    print("=== INICIO TESTS MANUALES ALESPORT ===")
    print(f"BASE_URL: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat(timespec='seconds')}")

    for user in USERS:
        run_tests_for_user(user)

    run_auth_guard_checks()
    print("\n=== TODO OK ===")
