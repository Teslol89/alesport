from app.auth.security import hash_password
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
