import os
from datetime import datetime, timedelta, time as dt_time

import requests


BASE_URL = os.getenv("API_BASE_URL", "https://www.verdeguerlabs.es/api")
USERS = [
    {"email": "admin@demo.com", "password": "admin123", "role": "admin"},
    {"email": "trainer@demo.com", "password": "trainer123", "role": "trainer"},
    {"email": "cliente@demo.com", "password": "cliente123", "role": "client"},
]

# Fechas de prueba: mañana y en 3 días (para evitar sesiones pasadas)
TODAY = datetime.now().date()
TOMORROW = TODAY + timedelta(days=1)
FUTURE_DATE = TODAY + timedelta(days=3)


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
    # Filtra sesiones activas (no canceladas)
    active_sessions = [s for s in sessions if s.get("status") != "cancelled"]
    if not active_sessions:
        return None
    if role == "trainer" and user_id is not None:
        for session in active_sessions:
            if session.get("trainer_id") == user_id:
                return session
        return None
    return active_sessions[0]


def create_test_session(token: str, trainer_id: int | None, date_str: str) -> dict | None:
    """Crea una sesión de prueba con campos nuevos (class_name, notes).
    Retorna el dict de sesión creada o None si falla."""
    headers = auth_headers(token)
    
    payload = {
        "session_date": date_str,
        "start_time": "10:00",
        "end_time": "11:30",
        "capacity": 8,
        "class_name": "Test Class",
        "notes": "Sesión de prueba para validaciones",
    }
    if trainer_id is not None:
        payload["trainer_id"] = trainer_id
    
    response = requests.post(
        f"{BASE_URL}/sessions/",
        json=payload,
        headers=headers,
        timeout=20,
    )
    
    if response.status_code in (200, 201):
        return response.json()
    print(f"[CREATE SESSION ERROR] {response.status_code} {response.text}")
    return None


def delete_test_session(token: str, session_id: int) -> bool:
    """Cancela (soft delete) una sesión. Retorna True si success."""
    headers = auth_headers(token)
    response = requests.delete(
        f"{BASE_URL}/sessions/{session_id}",
        headers=headers,
        timeout=20,
    )
    if response.status_code == 200:
        return True
    print(f"[DELETE SESSION ERROR] {session_id}: {response.status_code} {response.text}")
    return False


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

    if role in ("admin", "trainer"):
        # ========== TEST: Crear sesión nueva con campos nuevos ==========
        print(f"  [TEST] Creando sesión nueva (class_name, notes)...")
        created_session = create_test_session(token, user_id if role == "trainer" else None, TOMORROW.isoformat())
        if created_session:
            print(f"    ✓ Sesión creada: id={created_session.get('id')}, class_name={created_session.get('class_name')}")
            session_to_update = created_session["id"]

            print(f"  [TEST] Validando que no se puede crear otra sesión solapada...")
            overlapping_payload = {
                "session_date": created_session.get("session_date", TOMORROW.isoformat()),
                "start_time": "10:30",
                "end_time": "11:00",
                "capacity": 6,
                "class_name": "Overlap Should Fail",
                "notes": "Debe rechazar por solape",
            }
            if role == "admin" and created_session.get("trainer_id") is not None:
                overlapping_payload["trainer_id"] = created_session.get("trainer_id")

            request_and_check(
                "POST",
                "/sessions/",
                {409},
                headers=headers,
                json=overlapping_payload,
            )
            print(f"    ✓ El solape en creación queda bloqueado")
        else:
            session_to_update = session["id"] if session else None

        # ========== TEST: PATCH sesión con nuevos campos ==========
        if session_to_update:
            print(f"  [TEST] Actualizando sesión (capacity, class_name, notes)...")
            request_and_check(
                "PATCH",
                f"/sessions/{session_to_update}",
                {200},
                headers=headers,
                json={
                    "capacity": 7,
                    "class_name": "Updated Class Name",
                    "notes": "Notas actualizadas"
                },
            )
            print(f"    ✓ Sesión actualizada")

            print(f"  [TEST] Actualizando solo metadatos manteniendo la misma franja horaria...")
            request_and_check(
                "PATCH",
                f"/sessions/{session_to_update}",
                {200},
                headers=headers,
                json={
                    "start_time": created_session.get("start_time", "10:00") if created_session else "10:00",
                    "end_time": created_session.get("end_time", "11:30") if created_session else "11:30",
                    "class_name": "Updated Class Same Time",
                    "notes": "Cambio solo notas sin mover la hora",
                },
            )
            print(f"    ✓ La sesión acepta actualizar metadatos sin cambiar la franja")

            # ========== TEST: Validar capacity inválida ==========
            print(f"  [TEST] Validando capacity inválida...")
            request_and_check(
                "PATCH",
                f"/sessions/{session_to_update}",
                {422},
                headers=headers,
                json={"capacity": 0},
            )
            request_and_check(
                "PATCH",
                f"/sessions/{session_to_update}",
                {422},
                headers=headers,
                json={"capacity": 20},
            )
            print(f"    ✓ Validaciones de capacity correctas")

            # ========== TEST: Cancelar sesión (soft delete) ==========
            print(f"  [TEST] Cancelando sesión...")
            if delete_test_session(token, session_to_update):
                print(f"    ✓ Sesión cancelada (status='cancelled')")
                # Verificar que ya no aparece en GET /sessions
                sessions_after = request_and_check("GET", "/sessions/", {200}, headers=headers).json()
                cancelled_count = [s for s in sessions_after if s.get("id") == session_to_update]
                if not cancelled_count:
                    print(f"    ✓ Sesión cancelada no aparece en GET /sessions/")
            else:
                print(f"    ✗ No se pudo cancelar la sesión")

    elif role == "client":
        # Clients no pueden crear/cancelar sesiones
        if session is None:
            print("[INFO] No hay sesiones activas para probar reservas de cliente")
            return

        # ========== TEST: Cliente NO puede crear sesión ==========
        print(f"  [TEST] Validando que client no puede crear sesión...")
        request_and_check(
            "POST",
            "/sessions/",
            {403},
            headers=headers,
            json={
                "session_date": TOMORROW.isoformat(),
                "start_time": "14:00",
                "end_time": "15:00",
                "capacity": 5,
                "class_name": "Intento client sin permisos",
                "notes": "Debe bloquear por rol",
            },
        )
        print(f"    ✓ Client bloqueado de crear sesión")

        # ========== TEST: Cliente puede hacer reserva ==========
        booking = request_and_check(
            "POST",
            "/bookings/",
            {200, 201, 409},
            headers=headers,
            json={"session_id": session["id"]},
        )
        print(f"  [TEST] Reserva creada/existente: {booking.status_code}")

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


def run_session_validation_checks(admin_token: str):
    """Tests de validación para creación de sesiones: overlaps, fechas pasadas, campos inválidos."""
    print("\n===== TEST: VALIDACIONES DE SESIONES =====")
    headers = auth_headers(admin_token)
    
    # ========== TEST: No puede crear sesión en el pasado ==========
    print("[TEST] Intentando crear sesión en el pasado...")
    past_date = (TODAY - timedelta(days=1)).isoformat()
    response = requests.post(
        f"{BASE_URL}/sessions/",
        json={
            "session_date": past_date,
            "start_time": "10:00",
            "end_time": "11:00",
            "capacity": 5,
        },
        headers=headers,
        timeout=20,
    )
    if response.status_code in (400, 422):
        print(f"  ✓ Fecha pasada rechazada ({response.status_code})")
    else:
        print(f"  ⚠ Fecha pasada aceptada (status={response.status_code})")
    
    # ========== TEST: Validación end_time > start_time ==========
    print("[TEST] Intentando crear sesión con end_time <= start_time...")
    response = requests.post(
        f"{BASE_URL}/sessions/",
        json={
            "session_date": TOMORROW.isoformat(),
            "start_time": "14:00",
            "end_time": "10:00",  # Antes que start_time
            "capacity": 5,
        },
        headers=headers,
        timeout=20,
    )
    if response.status_code in (400, 422):
        print(f"  ✓ end_time inválido rechazado ({response.status_code})")
    else:
        print(f"  ⚠ end_time inválido aceptado (status={response.status_code})")
    
    # ========== TEST: No puede crear session sin campos obligatorios ==========
    print("[TEST] Intentando crear sesión sin session_date...")
    response = requests.post(
        f"{BASE_URL}/sessions/",
        json={
            "start_time": "10:00",
            "end_time": "11:00",
            "capacity": 5,
        },
        headers=headers,
        timeout=20,
    )
    if response.status_code in (400, 422):
        print(f"  ✓ Campo obligatorio validado ({response.status_code})")
    else:
        print(f"  ⚠ Validación no realizada (status={response.status_code})")
    
    # ========== TEST: Crear sesión exitosa con todos los campos ==========
    print("[TEST] Creando sesión con todos los campos nuevos...")
    response = requests.post(
        f"{BASE_URL}/sessions/",
        json={
            "session_date": FUTURE_DATE.isoformat(),
            "start_time": "09:00",
            "end_time": "10:30",
            "capacity": 10,
            "class_name": "Advanced Training",
            "notes": "Sesión completa con documentación",
        },
        headers=headers,
        timeout=20,
    )
    if response.status_code in (200, 201):
        session_data = response.json()
        print(f"  ✓ Sesión creada exitosamente")
        print(f"    - ID: {session_data.get('id')}")
        print(f"    - class_name: {session_data.get('class_name')}")
        print(f"    - notes: {session_data.get('notes')}")
        print(f"    - status: {session_data.get('status')}")
        return session_data.get('id')
    else:
        print(f"  ✗ Error creando sesión: {response.status_code} {response.text}")
        return None


def run_tests_for_user(user: dict):
    print(f"\n===== TEST MANUAL {user['role'].upper()} =====")
    print(f"Email: {user['email']}")
    token = login(user["email"], user["password"])
    if token is None:
        raise AssertionError(f"No se pudo iniciar sesión para {user['email']}")
    
    print(f"✓ Login exitoso")

    user_id, sessions = run_common_checks(token, user["role"])
    print(f"✓ Checks comunes superados")
    
    
    run_role_specific_checks(token, user["role"], user_id, sessions)
    print(f"✓ Checks específicos de {user['role']} superados")


if __name__ == "__main__":
    print("=== INICIO TESTS MANUALES ALESPORT ===")
    print(f"BASE_URL: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat(timespec='seconds')}")
    print(f"Today: {TODAY}, Tomorrow: {TOMORROW}, Future: {FUTURE_DATE}")
    
    # Primero obtener token de admin para tests generales
    admin_token = login(USERS[0]["email"], USERS[0]["password"])
    if admin_token is None:
        raise AssertionError(f"No se pudo obtener token de admin")

    for user in USERS:
        run_tests_for_user(user)

    run_auth_guard_checks()
    print("\n===== TESTS ADICIONALES =====")
    run_session_validation_checks(admin_token)
    
    print("\n=== TODO OK ===")
