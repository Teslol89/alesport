def test_client_cannot_list_users(client, auth_headers, seed_data):
    headers = auth_headers(seed_data["client"].email, "client1234")

    response = client.get("/users/", headers=headers)

    assert response.status_code == 403
    assert response.json()["detail"] == "Solo administradores pueden ver la lista de usuarios"


def test_trainer_cannot_create_booking(client, auth_headers, seed_data):
    headers = auth_headers(seed_data["trainer"].email, "trainer1234")

    response = client.post(
        "/bookings/",
        headers=headers,
        json={"session_id": seed_data["session"].id},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Solo los clientes pueden reservar sesiones"


def test_client_can_create_booking(client, auth_headers, seed_data):
    headers = auth_headers(seed_data["client"].email, "client1234")

    response = client.post(
        "/bookings/",
        headers=headers,
        json={"session_id": seed_data["session"].id},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["user_id"] == seed_data["client"].id
    assert body["session_id"] == seed_data["session"].id
    assert body["status"] == "active"


def test_trainer_cannot_create_weekly_schedule(client, auth_headers, seed_data):
    headers = auth_headers(seed_data["trainer"].email, "trainer1234")

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

    assert response.status_code == 403
    assert response.json()["detail"] == "Solo el administrador puede crear horarios semanales"


def test_admin_can_create_weekly_schedule(client, auth_headers, seed_data):
    headers = auth_headers(seed_data["admin"].email, "admin1234")

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

    assert response.status_code == 200
    body = response.json()
    assert body["trainer_id"] == seed_data["trainer"].id
    assert body["day_of_week"] == 2
    assert body["capacity"] == 8


def test_trainer_cannot_generate_sessions(client, auth_headers, seed_data):
    headers = auth_headers(seed_data["trainer"].email, "trainer1234")

    response = client.post(
        "/schedule/generate-sessions",
        headers=headers,
        json={"weeks_ahead": 1},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Solo administradores pueden generar sesiones manualmente"