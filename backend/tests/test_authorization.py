def test_client_cannot_list_users(client, auth_headers, seed_data):
    """Test: Solo admins pueden ver lista de todos los usuarios.
    
    Verificación de autorización por role:
    - Client intenta GET /api/users/ -> Derecho denegado (403 Forbidden)
    
    Control de acceso basado en rol (RBAC):
    El endpoint /users/ tiene validación: if current_user.role != "admin": raise 403
    """
    # Autenticarse como client
    headers = auth_headers(seed_data["client"].email, "client1234")

    # Intentar listar usuarios
    response = client.get("/api/users/", headers=headers)

    # Verificar que fue denegado
    assert response.status_code == 403  # Forbidden
    assert response.json()["detail"] == "Solo administradores pueden ver la lista de usuarios"


def test_trainer_cannot_create_booking(client, auth_headers, seed_data):
    """Test: Solo clients pueden crear bookings. Trainers no pueden.
    
    Verificación de autorización por role:
    - Trainer intenta POST /api/bookings/ -> Derecho denegado (403 Forbidden)
    
    Regla de negocio: Una reserva debe ser un client.
    El endpoint valida: if current_user.role != "client": raise 403
    """
    # Autenticarse como trainer
    headers = auth_headers(seed_data["trainer"].email, "trainer1234")

    # Intentar crear booking (reserva de sesión)
    response = client.post(
        "/api/bookings/",
        headers=headers,
        json={"session_id": seed_data["session"].id},
    )

    # Verificar que fue denegado
    assert response.status_code == 403  # Forbidden
    assert response.json()["detail"] == "Solo los clientes pueden reservar sesiones"


def test_client_can_create_booking(client, auth_headers, seed_data):
    """Test: Clients PUEDEN crear bookings y se asignan a sí mismos.
    
    Verificación de autorización + creación:
    - Client auténtico puede crear booking
    - El user_id se asigna automáticamente del JWT (no del body)
    - Status inicial es "active"
    
    Seguridad: No se puede hacer booking para otro usuario.
    El endpoint extrae: user_id = current_user.id (del JWT, no del request)
    """
    # Autenticarse como client
    headers = auth_headers(seed_data["client"].email, "client1234")

    # Crear booking (reserva de sesión)
    response = client.post(
        "/api/bookings/",
        headers=headers,
        json={"session_id": seed_data["session"].id},
    )

    # Verificar que fue exitoso (201 Created)
    assert response.status_code == 201
    
    # Verificar los datos del booking creado
    body = response.json()
    assert body["user_id"] == seed_data["client"].id  # Asignado automáticamente
    assert body["session_id"] == seed_data["session"].id  # Sesión correcta
    assert body["status"] == "active"  # Status inicial


def test_admin_can_patch_client_plan_settings(client, auth_headers, seed_data):
    """Un admin puede actualizar acceso, membresía y cupo mensual de un cliente."""
    headers = auth_headers(seed_data["admin"].email, "admin1234")

    response = client.patch(
        f"/api/users/{seed_data['client'].id}",
        headers=headers,
        json={
            "is_active": True,
            "membership_active": True,
            "monthly_booking_quota": 8,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["monthly_booking_quota"] == 8
    assert body["is_active"] is True
    assert body["membership_active"] is True


def test_client_cannot_exceed_monthly_booking_quota(client, auth_headers, seed_data, db_session):
    """Un cliente con cupo mensual alcanzado no puede crear otra reserva activa ese mes."""
    from datetime import timedelta
    from app.models.booking import Booking
    from app.models.session import SessionModel

    seed_data["client"].monthly_booking_quota = 1
    db_session.commit()

    existing_booking = Booking(
        user_id=seed_data["client"].id,
        session_id=seed_data["session"].id,
        status="active",
    )
    db_session.add(existing_booking)

    second_session = SessionModel(
        trainer_id=seed_data["trainer"].id,
        start_time=seed_data["session"].start_time + timedelta(days=2),
        end_time=seed_data["session"].end_time + timedelta(days=2),
        capacity=8,
        status="active",
        class_name="Clase control cuota",
    )
    db_session.add(second_session)
    db_session.commit()
    db_session.refresh(second_session)

    headers = auth_headers(seed_data["client"].email, "client1234")
    response = client.post(
        "/api/bookings/",
        headers=headers,
        json={"session_id": second_session.id},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Has alcanzado tu cupo mensual de reservas"


def test_trainer_cannot_create_weekly_schedule(client, auth_headers, seed_data):
    """Test: Solo admins pueden crear horarios semanales.
    
    Verificación de autorización por role:
    - Trainer intenta POST /api/schedule/ -> Derecho denegado (403)
    
    Regla: Schedules (plantillas) solo se crean por administrador.
    El endpoint valida: if current_user.role != "admin": raise 403
    """
    # Autenticarse como trainer
    headers = auth_headers(seed_data["trainer"].email, "trainer1234")

    # Intentar crear horario semanal
    response = client.post(
        "/api/schedule/",
        headers=headers,
        json={
            "trainer_id": seed_data["trainer"].id,
            "day_of_week": 1,
            "start_time": "09:00",
            "end_time": "10:00",
            "capacity": 8,
            "class_name": "Clase test trainer",
            "weeks_ahead": 1,
        },
    )

    # Verificar que fue denegado
    assert response.status_code == 403  # Forbidden
    assert response.json()["detail"] == "Solo el administrador puede crear horarios semanales"


def test_admin_can_create_weekly_schedule(client, auth_headers, seed_data):
    """Test: Admins PUEDEN crear horarios semanales.
    
    Verificación de autorización + creación:
    - Admin pueden crear weekly schedules
    - El horario se crea con los datos proporcionados
    - Se retorna 200 OK con los datos creados
    
    Business logic: Schedules son plantillas que el admin configura,
    luego se "generan" (expanden) en sesiones individuales para clientes.
    """
    # Autenticarse como admin
    headers = auth_headers(seed_data["admin"].email, "admin1234")

    # Crear horario semanal
    response = client.post(
        "/api/schedule/",
        headers=headers,
        json={
            "trainer_id": seed_data["trainer"].id,
            "day_of_week": 2,
            "start_time": "11:00",
            "end_time": "12:00",
            "capacity": 8,
            "class_name": "Clase test admin",
            "weeks_ahead": 1,
        },
    )

    # Verificar que fue exitoso (200 OK)
    assert response.status_code == 200
    
    # Verificar que el horario se creó con los datos correctos
    body = response.json()
    assert body["trainer_id"] == seed_data["trainer"].id
    assert body["day_of_week"] == 2
    assert body["capacity"] == 8


def test_trainer_cannot_generate_sessions(client, auth_headers, seed_data):
    """Test: Solo admins pueden generar sesiones manualmente.
    
    Verificación de autorización por role:
    - Trainer intenta POST /api/schedule/generate-sessions -> Denegado (403)
    
    Explicación: La generación de sesiones es operación administrativa crítica.
    El endpoint valida: if current_user.role != "admin": raise 403
    
    Generación: Toma los WeeklySchedules y expande en sesiones (una por semana).
    """
    # Autenticarse como trainer
    headers = auth_headers(seed_data["trainer"].email, "trainer1234")

    # Intentar generar sesiones (operación admin)
    response = client.post(
        "/api/schedule/generate-sessions",
        headers=headers,
        json={"weeks_ahead": 1},
    )

    # Verificar que fue denegado
    assert response.status_code == 403  # Forbidden
    assert response.json()["detail"] == "Solo administradores pueden generar sesiones manualmente"


def test_admin_can_create_weekly_schedule_with_fixed_students(client, auth_headers, seed_data, db_session):
    """Un admin puede dejar alumnos fijos en un horario y el sistema los reserva al generar sesiones."""
    from app.models.booking import Booking
    from app.models.session import SessionModel

    headers = auth_headers(seed_data["admin"].email, "admin1234")

    response = client.post(
        "/api/schedule/",
        headers=headers,
        json={
            "trainer_id": seed_data["trainer"].id,
            "day_of_week": 2,
            "start_time": "11:00",
            "end_time": "12:00",
            "capacity": 8,
            "class_name": "Clase fija admin",
            "weeks_ahead": 1,
            "fixed_student_ids": [seed_data["client"].id],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["trainer_id"] == seed_data["trainer"].id
    assert body["fixed_student_ids"] == [seed_data["client"].id]

    generated_sessions = (
        db_session.query(SessionModel)
        .filter(
            SessionModel.trainer_id == seed_data["trainer"].id,
            SessionModel.id != seed_data["session"].id,
        )
        .all()
    )
    assert generated_sessions

    generated_session_ids = [session.id for session in generated_sessions]
    generated_bookings = (
        db_session.query(Booking)
        .filter(
            Booking.user_id == seed_data["client"].id,
            Booking.session_id.in_(generated_session_ids),
            Booking.status == "active",
        )
        .all()
    )
    assert len(generated_bookings) == len(generated_sessions)

    second_generation = client.post(
        "/api/schedule/generate-sessions",
        headers=headers,
        json={"weeks_ahead": 1},
    )
    assert second_generation.status_code == 200

    booking_count_after_regeneration = (
        db_session.query(Booking)
        .filter(
            Booking.user_id == seed_data["client"].id,
            Booking.session_id.in_(generated_session_ids),
            Booking.status == "active",
        )
        .count()
    )
    assert booking_count_after_regeneration == len(generated_sessions)


def test_admin_cannot_create_overlapping_weekly_schedule_for_other_trainer(client, auth_headers, seed_data, db_session):
    """No debe permitirse la misma franja horaria semanal aunque sea otro entrenador."""
    from app.models.user import User
    from app.auth.security import hash_password

    second_trainer = User(
        name="Trainer 2",
        email="trainer2@example.com",
        password_hash=hash_password("trainer2234"),
        role="trainer",
        is_active=True,
        membership_active=True,
        monthly_booking_quota=12,
        is_verified=True,
    )
    db_session.add(second_trainer)
    db_session.commit()
    db_session.refresh(second_trainer)

    headers = auth_headers(seed_data["admin"].email, "admin1234")

    first_response = client.post(
        "/api/schedule/",
        headers=headers,
        json={
            "trainer_id": seed_data["trainer"].id,
            "day_of_week": 2,
            "start_time": "11:00",
            "end_time": "12:00",
            "capacity": 8,
            "class_name": "Slot base",
            "weeks_ahead": 1,
        },
    )
    assert first_response.status_code == 200

    overlap_response = client.post(
        "/api/schedule/",
        headers=headers,
        json={
            "trainer_id": second_trainer.id,
            "day_of_week": 2,
            "start_time": "11:00",
            "end_time": "12:00",
            "capacity": 8,
            "class_name": "Slot solapado",
            "weeks_ahead": 1,
        },
    )

    assert overlap_response.status_code == 409
    assert overlap_response.json()["detail"] == "Ya existe otra clase activa en esa franja horaria"


def test_admin_can_create_recurring_sessions_with_fixed_students(client, auth_headers, seed_data, db_session):
    """La creación recurrente desde /sessions/recurring preasigna clientes fijos a cada sesión nueva."""
    from app.models.booking import Booking

    headers = auth_headers(seed_data["admin"].email, "admin1234")

    response = client.post(
        "/api/sessions/recurring",
        headers=headers,
        json={
            "sessions": [
                {
                    "session_date": "2030-04-15",
                    "start_time": "10:00",
                    "end_time": "11:00",
                    "capacity": 5,
                    "class_name": "Grupo fijo mañana",
                    "trainer_id": seed_data["trainer"].id,
                    "fixed_student_ids": [seed_data["client"].id],
                },
                {
                    "session_date": "2030-04-17",
                    "start_time": "10:00",
                    "end_time": "11:00",
                    "capacity": 5,
                    "class_name": "Grupo fijo miércoles",
                    "trainer_id": seed_data["trainer"].id,
                    "fixed_student_ids": [seed_data["client"].id],
                },
            ]
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert len(body) == 2

    created_session_ids = [item["id"] for item in body]
    created_bookings = (
        db_session.query(Booking)
        .filter(
            Booking.user_id == seed_data["client"].id,
            Booking.session_id.in_(created_session_ids),
            Booking.status == "active",
        )
        .all()
    )
    assert len(created_bookings) == 2


def test_admin_can_copy_week_sessions_with_fixed_students(client, auth_headers, seed_data, db_session):
    """Al copiar una semana, las reservas activas de clientes también se duplican en la semana destino."""
    from app.models.booking import Booking

    headers = auth_headers(seed_data["admin"].email, "admin1234")

    create_response = client.post(
        "/api/sessions/recurring",
        headers=headers,
        json={
            "sessions": [
                {
                    "session_date": "2030-04-15",
                    "start_time": "10:00",
                    "end_time": "11:00",
                    "capacity": 5,
                    "class_name": "Grupo fijo lunes",
                    "trainer_id": seed_data["trainer"].id,
                    "fixed_student_ids": [seed_data["client"].id],
                },
                {
                    "session_date": "2030-04-17",
                    "start_time": "10:00",
                    "end_time": "11:00",
                    "capacity": 5,
                    "class_name": "Grupo fijo miércoles",
                    "trainer_id": seed_data["trainer"].id,
                    "fixed_student_ids": [seed_data["client"].id],
                },
            ]
        },
    )

    assert create_response.status_code == 201

    copy_response = client.post(
        "/api/sessions/copy-week",
        headers=headers,
        json={
            "source_week_start_date": "2030-04-15",
            "target_week_start_date": "2030-04-22",
            "trainer_id": seed_data["trainer"].id,
        },
    )

    assert copy_response.status_code == 201
    copied_sessions = copy_response.json()
    assert len(copied_sessions) == 2

    copied_session_ids = [item["id"] for item in copied_sessions]
    copied_bookings = (
        db_session.query(Booking)
        .filter(
            Booking.user_id == seed_data["client"].id,
            Booking.session_id.in_(copied_session_ids),
            Booking.status == "active",
        )
        .all()
    )
    assert len(copied_bookings) == 2


def test_copy_week_excludes_fixed_students_without_active_plan(client, auth_headers, seed_data, db_session):
    """Si un alumno fijo se queda sin plan antes de copiar semana, no debe copiarse su reserva."""
    from app.models.booking import Booking

    headers = auth_headers(seed_data["admin"].email, "admin1234")

    create_response = client.post(
        "/api/sessions/recurring",
        headers=headers,
        json={
            "sessions": [
                {
                    "session_date": "2030-04-15",
                    "start_time": "10:00",
                    "end_time": "11:00",
                    "capacity": 5,
                    "class_name": "Grupo fijo lunes",
                    "trainer_id": seed_data["trainer"].id,
                    "fixed_student_ids": [seed_data["client"].id],
                }
            ]
        },
    )
    assert create_response.status_code == 201

    seed_data["client"].monthly_booking_quota = None
    db_session.commit()

    copy_response = client.post(
        "/api/sessions/copy-week",
        headers=headers,
        json={
            "source_week_start_date": "2030-04-15",
            "target_week_start_date": "2030-04-22",
            "trainer_id": seed_data["trainer"].id,
        },
    )

    assert copy_response.status_code == 201
    copied_sessions = copy_response.json()
    assert len(copied_sessions) == 1

    copied_session_id = copied_sessions[0]["id"]
    copied_booking_count = (
        db_session.query(Booking)
        .filter(
            Booking.user_id == seed_data["client"].id,
            Booking.session_id == copied_session_id,
            Booking.status == "active",
        )
        .count()
    )
    assert copied_booking_count == 0