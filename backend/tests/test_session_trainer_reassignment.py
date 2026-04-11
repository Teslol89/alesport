from app.auth.security import hash_password
from app.models.booking import Booking
from app.models.user import User


def test_admin_can_reassign_session_trainer(client, auth_headers, seed_data, db_session):
    """El admin puede cambiar el entrenador de una sesión futura."""
    new_trainer = User(
        name="Trainer 2",
        email="trainer2@example.com",
        password_hash=hash_password("trainer1234"),
        role="trainer",
        is_active=True,
        membership_active=True,
        is_verified=True,
    )
    db_session.add(new_trainer)
    db_session.commit()
    db_session.refresh(new_trainer)

    headers = auth_headers(seed_data["admin"].email, "admin1234")

    response = client.patch(
        f"/api/sessions/{seed_data['session'].id}",
        headers=headers,
        json={"trainer_id": new_trainer.id},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["trainer_id"] == new_trainer.id
    assert body["trainer_name"] == "Trainer 2"


def test_trainer_cannot_reassign_session_to_someone_else(client, auth_headers, seed_data):
    """Un trainer no puede cambiar el entrenador asignado de una sesión."""
    headers = auth_headers(seed_data["trainer"].email, "trainer1234")

    response = client.patch(
        f"/api/sessions/{seed_data['session'].id}",
        headers=headers,
        json={"trainer_id": seed_data['admin'].id},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Solo un administrador puede cambiar el entrenador de la sesión"


def test_superadmin_can_reassign_session_trainer(client, auth_headers, seed_data, db_session):
    """El superadmin puede gestionar sesiones, pero no aparece como entrenador asignable."""
    superadmin = User(
        name="Marcos",
        email="marcos@example.com",
        password_hash=hash_password("marcos1234"),
        role="superadmin",
        is_active=True,
        membership_active=True,
        is_verified=True,
    )
    db_session.add(superadmin)
    db_session.commit()

    headers = auth_headers(superadmin.email, "marcos1234")

    response = client.patch(
        f"/api/sessions/{seed_data['session'].id}",
        headers=headers,
        json={"trainer_id": seed_data['admin'].id},
    )

    assert response.status_code == 200
    assert response.json()["trainer_id"] == seed_data["admin"].id


def test_admin_updating_session_time_does_not_send_push_notification(
    client, auth_headers, seed_data, db_session, monkeypatch
):
    """Cambiar la hora de una sesión no debe enviar push a los alumnos apuntados."""
    from app.services import session_service

    seed_data["client"].fcm_token = "client-token"
    db_session.add(
        Booking(
            user_id=seed_data["client"].id,
            session_id=seed_data["session"].id,
            status="active",
        )
    )
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
        session_service,
        "send_push_notification",
        fake_send_push_notification,
        raising=False,
    )

    headers = auth_headers(seed_data["admin"].email, "admin1234")
    response = client.patch(
        f"/api/sessions/{seed_data['session'].id}",
        headers=headers,
        json={"start_time": "18:00", "end_time": "19:00"},
    )

    assert response.status_code == 200
    assert response.json()["start_time"].startswith("18:00")
    assert sent_notifications == []
