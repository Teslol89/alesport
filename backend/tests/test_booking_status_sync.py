from app.models.booking import Booking


def _login_headers(client, email: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_session_becomes_completed_when_booking_reaches_capacity(
    client, seed_data, db_session
):
    seed_session = seed_data["session"]
    seed_data["client"].is_verified = True
    seed_session.capacity = 1
    seed_session.status = "active"
    db_session.commit()

    headers = _login_headers(client, seed_data["client"].email, "client1234")
    response = client.post(
        "/api/bookings/",
        headers=headers,
        json={"session_id": seed_session.id},
    )

    assert response.status_code == 201

    db_session.refresh(seed_session)
    assert seed_session.status == "completed"


def test_session_returns_to_active_when_cancelling_a_booking(
    client, seed_data, db_session
):
    seed_session = seed_data["session"]
    seed_data["admin"].is_verified = True
    seed_session.capacity = 2
    seed_session.status = "completed"
    booking = Booking(
        user_id=seed_data["client"].id,
        session_id=seed_session.id,
        status="active",
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)

    headers = _login_headers(client, seed_data["admin"].email, "admin1234")
    response = client.patch(f"/api/bookings/{booking.id}/cancel", headers=headers)

    assert response.status_code == 200

    db_session.refresh(seed_session)
    assert seed_session.status == "active"


def test_reactivate_booking_corrects_stale_completed_session_when_there_is_space(
    client, seed_data, db_session
):
    seed_session = seed_data["session"]
    seed_data["admin"].is_verified = True
    seed_session.capacity = 2
    seed_session.status = "completed"
    booking = Booking(
        user_id=seed_data["client"].id,
        session_id=seed_session.id,
        status="cancelled",
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)

    headers = _login_headers(client, seed_data["admin"].email, "admin1234")
    response = client.patch(f"/api/bookings/{booking.id}/reactivate", headers=headers)

    assert response.status_code == 200

    db_session.refresh(seed_session)
    db_session.refresh(booking)
    assert booking.status == "active"
    assert seed_session.status == "active"