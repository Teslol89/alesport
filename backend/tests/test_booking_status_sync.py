from datetime import datetime, timedelta, timezone

from app.auth.security import hash_password
from app.models.booking import Booking
from app.models.user import User


def _login_headers(client, email: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_full_session_creates_waitlist_booking(client, seed_data, db_session):
    seed_session = seed_data["session"]
    seed_session.capacity = 1
    seed_session.status = "completed"

    queued_client = User(
        name="Queued Client",
        email="queued@example.com",
        password_hash=hash_password("queued1234"),
        role="client",
        is_active=True,
        membership_active=True,
        is_verified=True,
    )
    existing_booking = Booking(
        user_id=seed_data["client"].id,
        session_id=seed_session.id,
        status="active",
    )
    db_session.add_all([queued_client, existing_booking])
    db_session.commit()
    db_session.refresh(queued_client)

    headers = _login_headers(client, queued_client.email, "queued1234")
    response = client.post(
        "/api/bookings/",
        headers=headers,
        json={"session_id": seed_session.id},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "waitlist"


def test_waitlist_booking_can_be_activated_when_there_is_space(
    client, seed_data, db_session
):
    seed_session = seed_data["session"]
    seed_data["admin"].is_verified = True
    seed_session.capacity = 2
    seed_session.status = "completed"
    queued_booking = Booking(
        user_id=seed_data["client"].id,
        session_id=seed_session.id,
        status="waitlist",
    )
    db_session.add(queued_booking)
    db_session.commit()
    db_session.refresh(queued_booking)

    headers = _login_headers(client, seed_data["admin"].email, "admin1234")
    response = client.patch(f"/api/bookings/{queued_booking.id}/reactivate", headers=headers)

    assert response.status_code == 200

    db_session.refresh(seed_session)
    db_session.refresh(queued_booking)
    assert queued_booking.status == "active"
    assert seed_session.status == "active"


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


def test_session_details_show_each_student_only_once(client, seed_data, db_session):
    seed_session = seed_data["session"]
    seed_data["admin"].is_verified = True

    cancelled_booking = Booking(
        user_id=seed_data["client"].id,
        session_id=seed_session.id,
        status="cancelled",
    )
    active_booking = Booking(
        user_id=seed_data["client"].id,
        session_id=seed_session.id,
        status="active",
    )
    db_session.add_all([cancelled_booking, active_booking])
    db_session.commit()
    db_session.refresh(active_booking)

    headers = _login_headers(client, seed_data["admin"].email, "admin1234")
    response = client.get(f"/api/bookings/session/{seed_session.id}", headers=headers)

    assert response.status_code == 200

    data = response.json()
    student_rows = [item for item in data if item["user_id"] == seed_data["client"].id]

    assert len(student_rows) == 1
    assert student_rows[0]["id"] == active_booking.id
    assert student_rows[0]["status"] == "active"


def test_cannot_create_booking_for_past_session(client, seed_data, db_session):
    seed_session = seed_data["session"]
    seed_data["client"].is_verified = True
    seed_session.start_time = datetime.now(timezone.utc) - timedelta(days=1)
    seed_session.end_time = seed_session.start_time + timedelta(hours=1)
    db_session.commit()

    headers = _login_headers(client, seed_data["client"].email, "client1234")
    response = client.post(
        "/api/bookings/",
        headers=headers,
        json={"session_id": seed_session.id},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "No se pueden modificar reservas de días pasados"


def test_cannot_cancel_booking_for_past_session(client, seed_data, db_session):
    seed_session = seed_data["session"]
    seed_data["admin"].is_verified = True
    seed_session.start_time = datetime.now(timezone.utc) - timedelta(days=1)
    seed_session.end_time = seed_session.start_time + timedelta(hours=1)
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

    assert response.status_code == 409
    assert response.json()["detail"] == "No se pueden modificar reservas de días pasados"


def test_cannot_update_past_session_hour(client, seed_data, db_session):
    seed_session = seed_data["session"]
    seed_data["admin"].is_verified = True
    seed_session.start_time = datetime.now(timezone.utc) - timedelta(days=1, hours=2)
    seed_session.end_time = seed_session.start_time + timedelta(hours=1)
    db_session.commit()

    headers = _login_headers(client, seed_data["admin"].email, "admin1234")
    response = client.patch(
        f"/api/sessions/{seed_session.id}",
        headers=headers,
        json={"start_time": "09:00", "end_time": "10:00"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "No se pueden modificar sesiones de días pasados"