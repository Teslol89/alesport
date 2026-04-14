def create_test_recurring_sessions(token: str, trainer_id: int | None, start_date: str, end_date: str, days_of_week: list[int]) -> list[dict] | None:
    """Crea varias sesiones recurrentes usando el endpoint /sessions/recurring."""
    headers = auth_headers(token)
    from datetime import datetime, timedelta
    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()
    sessions = []
    d = start
    while d <= end:
        if d.weekday() in days_of_week:
            sessions.append({
                "session_date": d.isoformat(),
                "start_time": "10:00",
                "end_time": "11:30",
                "capacity": 8,
                "class_name": f"Recurrente {d.isoformat()}",
                "notes": "Test recurrente",
                **({"trainer_id": trainer_id} if trainer_id is not None else {}),
            })
        d += timedelta(days=1)
    if not sessions:
        print("[RECURRING TEST] No hay días válidos para crear sesiones recurrentes.")
        return None
    response = requests.post(
        f"{BASE_URL}/sessions/recurring",
        json={"sessions": sessions},
        headers=headers,
        timeout=30,
    )
    if response.status_code in (200, 201):
        print(f"[RECURRING TEST] {len(sessions)} sesiones creadas correctamente.")
        return response.json()
    print(f"[RECURRING TEST ERROR] {response.status_code} {response.text}")
    return None
import os
import time
from datetime import datetime, timedelta, time as dt_time

import requests


BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000/api").rstrip("/")
USERS = [
    {
        "email": "verdeguerlabs@verdeguerlabs.es",
        "password": os.getenv("SUPERADMIN_PASSWORD", "Verdeguer89**"),
        "role": "superadmin",
    },
    {"email": "trainer@demo.com", "password": "trainer123", "role": "trainer"},
    {"email": "cliente@demo.com", "password": "cliente123", "role": "client"},
]

# Fechas de prueba: mañana y en 3 días (para evitar sesiones pasadas)
TODAY = datetime.now().date()
TOMORROW = TODAY + timedelta(days=1)
FUTURE_DATE = TODAY + timedelta(days=3)


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def wait_for_api(timeout_seconds: int = 60) -> None:
    last_error = "sin respuesta"
    for attempt in range(1, timeout_seconds + 1):
        try:
            response = requests.get(BASE_URL, timeout=5)
            if response.ok:
                print(f"[API READY] Backend disponible tras {attempt}s")
                return
            last_error = f"HTTP {response.status_code}: {response.text}"
        except requests.RequestException as exc:
            last_error = str(exc)
        time.sleep(1)

    raise RuntimeError(
        f"La API no respondió en {timeout_seconds}s en {BASE_URL}. Último error: {last_error}"
    )


def login(email: str, password: str) -> str | None:
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": email, "password": password},
            timeout=20,
        )
    except requests.RequestException as exc:
        print(f"[LOGIN ERROR] {email}: no se pudo conectar a {BASE_URL}/auth/login ({exc})")
        return None

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


def _parse_time_value(value: str | None) -> dt_time | None:
    if not value:
        return None

    normalized = value.strip()
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(normalized, fmt).time()
        except ValueError:
            continue
    return None


def _time_to_minutes(value: dt_time) -> int:
    return value.hour * 60 + value.minute


def _minutes_to_hhmm(total_minutes: int) -> str:
    hours = total_minutes // 60
    minutes = total_minutes % 60
    return f"{hours:02d}:{minutes:02d}"


def is_future_session(session: dict) -> bool:
    session_date = session.get("session_date")
    start_time = _parse_time_value(session.get("start_time"))
    if not session_date or start_time is None:
        return False

    try:
        session_dt = datetime.fromisoformat(f"{session_date}T{start_time.strftime('%H:%M:%S')}")
    except ValueError:
        return False

    return session_dt >= datetime.now()


def build_non_overlapping_session_payload(
    sessions: list[dict],
    date_candidates: list[str],
    *,
    trainer_id: int | None,
    class_name: str,
    notes: str,
    capacity: int,
    duration_minutes: int = 90,
) -> dict | None:
    active_sessions = [session for session in sessions if session.get("status") != "cancelled"]

    for date_str in date_candidates:
        busy_ranges: list[tuple[int, int]] = []
        for session in active_sessions:
            if str(session.get("session_date")) != date_str:
                continue

            start_value = _parse_time_value(session.get("start_time"))
            end_value = _parse_time_value(session.get("end_time"))
            if start_value is None or end_value is None:
                continue

            busy_ranges.append((_time_to_minutes(start_value), _time_to_minutes(end_value)))

        for start_minutes in range(6 * 60, 21 * 60 + 1, 30):
            end_minutes = start_minutes + duration_minutes
            if end_minutes > 23 * 60:
                continue

            overlaps = any(existing_start < end_minutes and existing_end > start_minutes for existing_start, existing_end in busy_ranges)
            if overlaps:
                continue

            payload = {
                "session_date": date_str,
                "start_time": _minutes_to_hhmm(start_minutes),
                "end_time": _minutes_to_hhmm(end_minutes),
                "capacity": capacity,
                "class_name": class_name,
                "notes": notes,
            }
            if trainer_id is not None:
                payload["trainer_id"] = trainer_id
            return payload

    return None


def pick_session_for_role(sessions: list[dict], role: str, user_id: int | None) -> dict | None:
    if not sessions:
        return None

    active_sessions = [s for s in sessions if s.get("status") != "cancelled" and is_future_session(s)]
    if not active_sessions:
        return None

    active_sessions.sort(key=lambda session: (str(session.get("session_date", "")), str(session.get("start_time", ""))))

    if role == "trainer" and user_id is not None:
        for session in active_sessions:
            if session.get("trainer_id") == user_id:
                return session
        return None

    return active_sessions[0]


def resolve_manager_trainer_id(role: str, user_id: int | None, sessions: list[dict]) -> int | None:
    """Obtiene un trainer_id válido para pruebas cuando el usuario autenticado es admin/superadmin."""
    if role == "trainer":
        return user_id

    for session in sessions:
        trainer_id = session.get("trainer_id")
        if not isinstance(trainer_id, (int, str)):
            continue
        try:
            numeric_trainer_id = int(trainer_id)
        except (TypeError, ValueError):
            continue
        if numeric_trainer_id > 0:
            return numeric_trainer_id

    return None


def create_test_session(
    token: str,
    trainer_id: int | None,
    date_str: str,
    existing_sessions: list[dict] | None = None,
) -> dict | None:
    """Crea una sesión futura de prueba en una franja libre para evitar falsos 409 por solape."""
    headers = auth_headers(token)
    sessions = existing_sessions or []

    preferred_date = datetime.fromisoformat(date_str).date()
    date_candidates = [(preferred_date + timedelta(days=offset)).isoformat() for offset in range(0, 7)]
    payload = build_non_overlapping_session_payload(
        sessions,
        date_candidates,
        trainer_id=trainer_id,
        class_name="Test Class",
        notes="Sesión de prueba para validaciones",
        capacity=8,
        duration_minutes=90,
    )

    if payload is None:
        print("[CREATE SESSION ERROR] No se encontró una franja libre para crear la sesión de prueba")
        return None

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


def create_test_session_with_payload(token: str, payload: dict) -> dict | None:
    """Crea una sesión de prueba con un payload arbitrario."""
    response = requests.post(
        f"{BASE_URL}/sessions/",
        json=payload,
        headers=auth_headers(token),
        timeout=20,
    )

    if response.status_code in (200, 201):
        return response.json()

    print(f"[CREATE SESSION ERROR] {response.status_code} {response.text}")
    return None


def run_common_checks(token: str, declared_role: str):
    headers = auth_headers(token)

    me = request_and_check("GET", "/auth/me", {200}, headers=headers).json()
    user_id = me.get("id")
    actual_role = str(me.get("role") or declared_role)

    sessions_resp = request_and_check("GET", "/sessions/", {200}, headers=headers)
    sessions = sessions_resp.json() if isinstance(sessions_resp.json(), list) else []

    if actual_role in ("admin", "superadmin"):
        request_and_check("GET", "/users/", {200}, headers=headers)
    else:
        request_and_check("GET", "/users/", {403}, headers=headers)

    request_and_check("GET", "/schedule/", {200}, headers=headers)

    if actual_role in ("admin", "superadmin"):
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

    return user_id, sessions, actual_role


def run_role_specific_checks(token: str, role: str, user_id: int | None, sessions: list[dict]):
    headers = auth_headers(token)
    session = pick_session_for_role(sessions, role, user_id)
    manager_trainer_id = resolve_manager_trainer_id(role, user_id, sessions)

    if role in ("admin", "superadmin", "trainer"):
        working_sessions = list(sessions)

        # ========== TEST: Crear sesión nueva con campos nuevos ==========
        print(f"  [TEST] Creando sesión nueva (class_name, notes)...")
        created_session = create_test_session(
            token,
            user_id if role == "trainer" else manager_trainer_id,
            TOMORROW.isoformat(),
            working_sessions,
        )
        if created_session:
            print(f"    ✓ Sesión creada: id={created_session.get('id')}, class_name={created_session.get('class_name')}")
            working_sessions.append(created_session)
            session_to_update = created_session["id"]

            print(f"  [TEST] Validando que no se puede crear otra sesión solapada...")
            overlapping_payload = {
                "session_date": created_session.get("session_date", TOMORROW.isoformat()),
                "start_time": created_session.get("start_time", "10:00"),
                "end_time": created_session.get("end_time", "11:30"),
                "capacity": 6,
                "class_name": "Overlap Should Fail",
                "notes": "Debe rechazar por solape",
            }
            if role in ("admin", "superadmin") and created_session.get("trainer_id") is not None:
                overlapping_payload["trainer_id"] = created_session.get("trainer_id")

            request_and_check(
                "POST",
                "/sessions/",
                {409},
                headers=headers,
                json=overlapping_payload,
            )
            print(f"    ✓ El solape en creación queda bloqueado")

            print(f"  [TEST] Validando que no se puede editar una sesión para solaparla con otra...")
            second_payload = build_non_overlapping_session_payload(
                working_sessions,
                [created_session.get("session_date", TOMORROW.isoformat())],
                trainer_id=created_session.get("trainer_id") if role in ("admin", "superadmin") else user_id,
                class_name="Second Session For Overlap Edit",
                notes="Base para probar PATCH solapado",
                capacity=6,
                duration_minutes=60,
            )

            if second_payload:
                second_session = create_test_session_with_payload(token, second_payload)
                if second_session:
                    request_and_check(
                        "PATCH",
                        f"/sessions/{second_session['id']}",
                        {409},
                        headers=headers,
                        json={
                            "start_time": created_session.get("start_time", "10:00"),
                            "end_time": created_session.get("end_time", "11:30"),
                        },
                    )
                    print(f"    ✓ El solape en edición queda bloqueado")
                    delete_test_session(token, second_session["id"])
            else:
                print("    ⚠ No se encontró una segunda franja libre para validar el solape en edición")
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
        # Tras hardening de negocio, también es válido un 403 si el cliente
        # no tiene plan activo o la membresía está inactiva.
        booking = request_and_check(
            "POST",
            "/bookings/",
            {200, 201, 403, 409},
            headers=headers,
            json={"session_id": session["id"]},
        )
        print(f"  [TEST] Reserva creada/existente: {booking.status_code}")

        if booking.status_code == 403:
            detail = ""
            try:
                detail = str(booking.json().get("detail") or "")
            except Exception:
                detail = booking.text or ""

            known_forbidden_reasons = (
                "Sin plan activo",
                "Membresía inactiva",
                "no tiene plan activo",
            )
            if any(reason in detail for reason in known_forbidden_reasons):
                print(f"    ✓ Cliente sin plan/membresía: reserva bloqueada correctamente ({detail})")
                return

            raise AssertionError(f"403 inesperado en reserva de cliente. Body: {booking.text}")

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
    me = request_and_check("GET", "/auth/me", {200}, headers=headers).json()
    current_role = str(me.get("role") or "admin")
    current_user_id = me.get("id")
    
    # ========== TEST: No puede crear sesión en el pasado ==========
    print("[TEST] Intentando crear sesión en el pasado...")
    past_date = (TODAY - timedelta(days=1)).isoformat()
    existing_sessions_response = requests.get(
        f"{BASE_URL}/sessions/",
        headers=headers,
        timeout=20,
    )
    existing_sessions = existing_sessions_response.json() if existing_sessions_response.status_code == 200 else []
    manager_trainer_id = resolve_manager_trainer_id(current_role, current_user_id, existing_sessions)

    base_admin_payload = (
        {"trainer_id": manager_trainer_id}
        if current_role in ("admin", "superadmin") and manager_trainer_id is not None
        else {}
    )

    response = requests.post(
        f"{BASE_URL}/sessions/",
        json={
            "session_date": past_date,
            "start_time": "10:00",
            "end_time": "11:00",
            "capacity": 5,
            **base_admin_payload,
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
            **base_admin_payload,
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
            **base_admin_payload,
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
    success_payload = build_non_overlapping_session_payload(
        existing_sessions,
        [FUTURE_DATE.isoformat(), (FUTURE_DATE + timedelta(days=1)).isoformat(), (FUTURE_DATE + timedelta(days=2)).isoformat()],
        trainer_id=current_user_id if current_role == "trainer" else manager_trainer_id,
        class_name="Advanced Training",
        notes="Sesión completa con documentación",
        capacity=10,
        duration_minutes=90,
    )
    if success_payload is None:
        print("  ✗ No se encontró una franja libre para la creación exitosa de prueba")
        return None

    response = requests.post(
        f"{BASE_URL}/sessions/",
        json=success_payload,
        headers=headers,
        timeout=20,
    )
    if response.status_code in (200, 201):
        session_data = response.json()
        session_id = session_data.get('id')
        print(f"  ✓ Sesión creada exitosamente")
        print(f"    - ID: {session_id}")
        print(f"    - class_name: {session_data.get('class_name')}")
        print(f"    - notes: {session_data.get('notes')}")
        print(f"    - status: {session_data.get('status')}")
        if session_id is not None and delete_test_session(admin_token, session_id):
            print(f"    - cleanup: sesión de validación cancelada")
        return session_id
    else:
        print(f"  ✗ Error creando sesión: {response.status_code} {response.text}")
        return None


def run_tests_for_user(user: dict):
    print(f"\n===== TEST MANUAL {user['role'].upper()} =====")
    print(f"Email: {user['email']}")
    token = login(user["email"], user["password"])
    if token is None:
        raise AssertionError(f"No se pudo iniciar sesión para {user['email']}")
    
    user_id, sessions, actual_role = run_common_checks(token, user["role"])
    print(f"✓ Login exitoso (rol real: {actual_role})")
    print(f"✓ Checks comunes superados")

    run_role_specific_checks(token, actual_role, user_id, sessions)
    print(f"✓ Checks específicos de {actual_role} superados")


if __name__ == "__main__":
    print("=== INICIO TESTS MANUALES ALESPORT ===")
    print(f"BASE_URL: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat(timespec='seconds')}")
    print(f"Today: {TODAY}, Tomorrow: {TOMORROW}, Future: {FUTURE_DATE}")

    wait_for_api()

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
