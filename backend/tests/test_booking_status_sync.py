from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

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
        monthly_booking_quota=12,
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


def test_cancelled_booking_is_reused_when_joining_waitlist(
    client, seed_data, db_session
):
    seed_session = seed_data["session"]
    seed_session.capacity = 1
    seed_session.status = "completed"

    occupant = User(
        name="Occupant Client",
        email="occupant@example.com",
        password_hash=hash_password("occupant1234"),
        role="client",
        is_active=True,
        membership_active=True,
        is_verified=True,
    )
    cancelled_booking = Booking(
        user_id=seed_data["client"].id,
        session_id=seed_session.id,
        status="cancelled",
    )
    active_booking = Booking(
        user_id=occupant.id,
        session_id=seed_session.id,
        status="active",
    )
    db_session.add_all([occupant, cancelled_booking])
    db_session.flush()
    active_booking.user_id = occupant.id
    db_session.add(active_booking)
    db_session.commit()
    db_session.refresh(cancelled_booking)

    headers = _login_headers(client, seed_data["client"].email, "client1234")
    response = client.post(
        "/api/bookings/",
        headers=headers,
        json={"session_id": seed_session.id},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "waitlist"
    assert response.json()["id"] == cancelled_booking.id


def test_cancelling_active_booking_notifies_first_waitlist_user(
    client, seed_data, db_session, monkeypatch
):
    from app.services import booking_service

    seed_session = seed_data["session"]
    seed_data["admin"].is_verified = True
    seed_session.capacity = 1
    seed_session.status = "completed"
    seed_session.start_time = datetime(2026, 4, 15, 7, 0, tzinfo=timezone.utc)
    seed_session.end_time = datetime(2026, 4, 15, 8, 0, tzinfo=timezone.utc)

    queued_user = User(
        name="Queued Client Push",
        email="queuedpush@example.com",
        password_hash=hash_password("queued1234"),
        role="client",
        is_active=True,
        membership_active=True,
        is_verified=True,
        fcm_token="test-fcm-token",
    )
    db_session.add(queued_user)
    db_session.flush()

    active_booking = Booking(
        user_id=seed_data["client"].id,
        session_id=seed_session.id,
        status="active",
    )
    waitlist_booking = Booking(
        user_id=queued_user.id,
        session_id=seed_session.id,
        status="waitlist",
    )
    db_session.add_all([active_booking, waitlist_booking])
    db_session.commit()
    db_session.refresh(active_booking)

    sent_notifications: list[dict] = []

    def fake_send_push_notification(tokens, title, body, data=None):
        sent_notifications.append({
            "tokens": tokens,
            "title": title,
            "body": body,
            "data": data or {},
        })

    monkeypatch.setattr(
        booking_service,
        "send_push_notification",
        fake_send_push_notification,
        raising=False,
    )

    headers = _login_headers(client, seed_data["admin"].email, "admin1234")
    response = client.patch(f"/api/bookings/{active_booking.id}/cancel", headers=headers)

    assert response.status_code == 200
    db_session.refresh(waitlist_booking)
    assert waitlist_booking.status == "offered"
    assert waitlist_booking.offer_expires_at is not None
    assert len(sent_notifications) == 1
    assert sent_notifications[0]["tokens"] == ["test-fcm-token"]
    assert sent_notifications[0]["data"]["session_id"] == str(seed_session.id)
    assert "09:00" in sent_notifications[0]["body"]


def test_expired_offer_moves_to_next_waitlist_user(client, seed_data, db_session, monkeypatch):
    from app.services import booking_service

    seed_session = seed_data["session"]
    seed_data["admin"].is_verified = True
    seed_session.capacity = 1
    seed_session.status = "completed"

    first_user = User(
        name="First Waitlist",
        email="firstwait@example.com",
        password_hash=hash_password("first1234"),
        role="client",
        is_active=True,
        membership_active=True,
        is_verified=True,
        fcm_token="first-token",
    )
    second_user = User(
        name="Second Waitlist",
        email="secondwait@example.com",
        password_hash=hash_password("second1234"),
        role="client",
        is_active=True,
        membership_active=True,
        is_verified=True,
        fcm_token="second-token",
    )
    db_session.add_all([first_user, second_user])
    db_session.flush()

    active_booking = Booking(
        user_id=seed_data["client"].id,
        session_id=seed_session.id,
        status="active",
    )
    first_waitlist = Booking(
        user_id=first_user.id,
        session_id=seed_session.id,
        status="waitlist",
    )
    second_waitlist = Booking(
        user_id=second_user.id,
        session_id=seed_session.id,
        status="waitlist",
    )
    db_session.add_all([active_booking, first_waitlist, second_waitlist])
    db_session.commit()

    sent_notifications: list[dict] = []

    def fake_send_push_notification(tokens, title, body, data=None):
        sent_notifications.append({
            "tokens": tokens,
            "title": title,
            "body": body,
            "data": data or {},
        })

    monkeypatch.setattr(
        booking_service,
        "send_push_notification",
        fake_send_push_notification,
        raising=False,
    )

    headers = _login_headers(client, seed_data["admin"].email, "admin1234")
    cancel_response = client.patch(f"/api/bookings/{active_booking.id}/cancel", headers=headers)
    assert cancel_response.status_code == 200

    db_session.refresh(first_waitlist)
    first_waitlist.offer_expires_at = datetime.now(ZoneInfo("UTC")) - timedelta(minutes=16)
    db_session.commit()

    refresh_response = client.get(f"/api/bookings/user/{second_user.id}", headers=headers)
    assert refresh_response.status_code == 200

    db_session.refresh(first_waitlist)
    db_session.refresh(second_waitlist)
    assert first_waitlist.status == "waitlist"
    assert second_waitlist.status == "offered"
    assert len(sent_notifications) == 2
    assert sent_notifications[-1]["tokens"] == ["second-token"]


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


def test_client_can_cancel_own_booking_with_enough_notice(client, seed_data, db_session):
    seed_session = seed_data["session"]
    seed_data["client"].is_verified = True
    seed_session.start_time = datetime.now(timezone.utc) + timedelta(days=1)
    seed_session.end_time = seed_session.start_time + timedelta(hours=1)
    db_session.commit()

    headers = _login_headers(client, seed_data["client"].email, "client1234")
    create_response = client.post(
        "/api/bookings/",
        headers=headers,
        json={"session_id": seed_session.id},
    )

    assert create_response.status_code == 201

    booking_id = create_response.json()["id"]
    cancel_response = client.patch(f"/api/bookings/{booking_id}/cancel", headers=headers)

    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == "cancelled"


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


def test_admin_search_shows_latest_status_only_once_per_student_session(client, seed_data, db_session):
    seed_session = seed_data["session"]
    seed_data["admin"].is_verified = True

    active_booking = Booking(
        user_id=seed_data["client"].id,
        session_id=seed_session.id,
        status="active",
    )
    db_session.add(active_booking)
    db_session.flush()

    cancelled_booking = Booking(
        user_id=seed_data["client"].id,
        session_id=seed_session.id,
        status="cancelled",
    )
    db_session.add(cancelled_booking)
    db_session.commit()
    db_session.refresh(cancelled_booking)

    headers = _login_headers(client, seed_data["admin"].email, "admin1234")
    response = client.get("/api/bookings/", headers=headers)

    assert response.status_code == 200

    data = response.json()
    student_rows = [
        item for item in data
        if item["user_id"] == seed_data["client"].id and item["session_id"] == seed_session.id
    ]

    assert len(student_rows) == 1
    assert student_rows[0]["id"] == cancelled_booking.id
    assert student_rows[0]["status"] == "cancelled"


def test_cannot_create_booking_for_session_that_has_already_started_today(client, seed_data, db_session):
    seed_session = seed_data["session"]
    seed_data["client"].is_verified = True

    madrid_now = datetime.now(ZoneInfo("Europe/Madrid"))
    start_local = madrid_now.replace(second=0, microsecond=0) - timedelta(minutes=30)
    if start_local.date() != madrid_now.date():
        start_local = madrid_now.replace(hour=0, minute=0, second=0, microsecond=0)

    seed_session.start_time = start_local.astimezone(timezone.utc)
    seed_session.end_time = (start_local + timedelta(hours=1)).astimezone(timezone.utc)
    db_session.commit()

    headers = _login_headers(client, seed_data["client"].email, "client1234")
    response = client.post(
        "/api/bookings/",
        headers=headers,
        json={"session_id": seed_session.id},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "No se pueden modificar reservas de clases iniciadas o pasadas"


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
    assert response.json()["detail"] == "No se pueden modificar reservas de clases iniciadas o pasadas"


def test_admin_cannot_cancel_booking_for_session_that_has_already_started_today(client, seed_data, db_session):
    seed_session = seed_data["session"]
    seed_data["admin"].is_verified = True

    madrid_now = datetime.now(ZoneInfo("Europe/Madrid"))
    start_local = madrid_now.replace(second=0, microsecond=0) - timedelta(minutes=20)
    if start_local.date() != madrid_now.date():
        start_local = madrid_now.replace(hour=0, minute=0, second=0, microsecond=0)

    seed_session.start_time = start_local.astimezone(timezone.utc)
    seed_session.end_time = (start_local + timedelta(hours=1)).astimezone(timezone.utc)
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
    assert response.json()["detail"] == "No se pueden modificar reservas de clases iniciadas o pasadas"


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
    assert response.json()["detail"] == "No se pueden modificar reservas de clases iniciadas o pasadas"


def test_client_cannot_cancel_booking_with_less_than_two_hours_notice(client, seed_data, db_session):
    seed_session = seed_data["session"]
    seed_data["client"].is_verified = True
    seed_session.start_time = datetime.now(timezone.utc) + timedelta(minutes=90)
    seed_session.end_time = seed_session.start_time + timedelta(hours=1)
    booking = Booking(
        user_id=seed_data["client"].id,
        session_id=seed_session.id,
        status="active",
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)

    headers = _login_headers(client, seed_data["client"].email, "client1234")
    response = client.patch(f"/api/bookings/{booking.id}/cancel", headers=headers)

    assert response.status_code == 409
    assert response.json()["detail"] == "Solo puedes cancelar con al menos 2 horas de antelación"


def test_admin_can_cancel_booking_with_less_than_two_hours_notice(client, seed_data, db_session):
    seed_session = seed_data["session"]
    seed_data["admin"].is_verified = True
    seed_session.start_time = datetime.now(timezone.utc) + timedelta(minutes=90)
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

    assert response.status_code == 200
    db_session.refresh(booking)
    assert booking.status == "cancelled"


def test_cannot_update_started_session_hour_today(client, seed_data, db_session):
    seed_session = seed_data["session"]
    seed_data["admin"].is_verified = True

    madrid_now = datetime.now(ZoneInfo("Europe/Madrid"))
    start_local = madrid_now.replace(second=0, microsecond=0) - timedelta(minutes=15)
    if start_local.date() != madrid_now.date():
        start_local = madrid_now.replace(hour=0, minute=0, second=0, microsecond=0)

    seed_session.start_time = start_local.astimezone(timezone.utc)
    seed_session.end_time = (start_local + timedelta(hours=1)).astimezone(timezone.utc)
    db_session.commit()

    headers = _login_headers(client, seed_data["admin"].email, "admin1234")
    response = client.patch(
        f"/api/sessions/{seed_session.id}",
        headers=headers,
        json={"start_time": "09:00", "end_time": "10:00"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "No se pueden modificar sesiones iniciadas o pasadas"


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
    assert response.json()["detail"] == "No se pueden modificar sesiones iniciadas o pasadas"