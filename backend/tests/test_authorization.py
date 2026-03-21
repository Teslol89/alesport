def test_client_cannot_list_users(client, auth_headers, seed_data):
    """Test: Solo admins pueden ver lista de todos los usuarios.
    
    Verificación de autorización por role:
    - Client intenta GET /users/ -> Derecho denegado (403 Forbidden)
    
    Control de acceso basado en rol (RBAC):
    El endpoint /users/ tiene validación: if current_user.role != "admin": raise 403
    """
    # Autenticarse como client
    headers = auth_headers(seed_data["client"].email, "client1234")

    # Intentar listar usuarios
    response = client.get("/users/", headers=headers)

    # Verificar que fue denegado
    assert response.status_code == 403  # Forbidden
    assert response.json()["detail"] == "Solo administradores pueden ver la lista de usuarios"


def test_trainer_cannot_create_booking(client, auth_headers, seed_data):
    """Test: Solo clients pueden crear bookings. Trainers no pueden.
    
    Verificación de autorización por role:
    - Trainer intenta POST /bookings/ -> Derecho denegado (403 Forbidden)
    
    Regla de negocio: Una reserva debe ser un client.
    El endpoint valida: if current_user.role != "client": raise 403
    """
    # Autenticarse como trainer
    headers = auth_headers(seed_data["trainer"].email, "trainer1234")

    # Intentar crear booking (reserva de sesión)
    response = client.post(
        "/bookings/",
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
        "/bookings/",
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


def test_trainer_cannot_create_weekly_schedule(client, auth_headers, seed_data):
    """Test: Solo admins pueden crear horarios semanales.
    
    Verificación de autorización por role:
    - Trainer intenta POST /schedule/ -> Derecho denegado (403)
    
    Regla: Schedules (plantillas) solo se crean por administrador.
    El endpoint valida: if current_user.role != "admin": raise 403
    """
    # Autenticarse como trainer
    headers = auth_headers(seed_data["trainer"].email, "trainer1234")

    # Intentar crear horario semanal
    response = client.post(
        "/schedule/",
        headers=headers,
        json={
            "trainer_id": seed_data["trainer"].id,
            "day_of_week": 1,
            "start_time": "09:00",
            "end_time": "10:00",
            "capacity": 8,
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
        "/schedule/",
        headers=headers,
        json={
            "trainer_id": seed_data["trainer"].id,
            "day_of_week": 2,
            "start_time": "11:00",
            "end_time": "12:00",
            "capacity": 8,
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
    - Trainer intenta POST /schedule/generate-sessions -> Denegado (403)
    
    Explicación: La generación de sesiones es operación administrativa crítica.
    El endpoint valida: if current_user.role != "admin": raise 403
    
    Generación: Toma los WeeklySchedules y expande en sesiones (una por semana).
    """
    # Autenticarse como trainer
    headers = auth_headers(seed_data["trainer"].email, "trainer1234")

    # Intentar generar sesiones (operación admin)
    response = client.post(
        "/schedule/generate-sessions",
        headers=headers,
        json={"weeks_ahead": 1},
    )

    # Verificar que fue denegado
    assert response.status_code == 403  # Forbidden
    assert response.json()["detail"] == "Solo administradores pueden generar sesiones manualmente"