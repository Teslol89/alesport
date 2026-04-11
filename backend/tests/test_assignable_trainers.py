from app.auth.security import hash_password
from app.models.user import User


def test_assignable_trainers_include_admin_but_exclude_superadmin(client, auth_headers, db_session, seed_data):
    """Los admins del centro sí pueden aparecer como entrenador; los superadmins técnicos no."""
    alex_admin = User(
        name="Álex",
        email="alex@example.com",
        password_hash=hash_password("alex1234"),
        role="admin",
        is_active=True,
        membership_active=True,
        is_verified=True,
    )
    marcos_superadmin = User(
        name="Marcos",
        email="marcos@example.com",
        password_hash=hash_password("marcos1234"),
        role="superadmin",
        is_active=True,
        membership_active=True,
        is_verified=True,
    )
    db_session.add_all([alex_admin, marcos_superadmin])
    db_session.commit()

    headers = auth_headers(seed_data["admin"].email, "admin1234")
    response = client.get("/api/users/assignable-trainers", headers=headers)

    assert response.status_code == 200
    body = response.json()
    names = {item["name"] for item in body}

    assert "Trainer" in names
    assert "Álex" in names
    assert "Marcos" not in names


def test_superadmin_can_list_users_but_is_not_assignable_trainer(client, auth_headers, db_session, seed_data):
    """El superadmin conserva permisos administrativos sin aparecer como entrenador."""
    marcos_superadmin = User(
        name="Marcos",
        email="marcos@example.com",
        password_hash=hash_password("marcos1234"),
        role="superadmin",
        is_active=True,
        membership_active=True,
        is_verified=True,
    )
    db_session.add(marcos_superadmin)
    db_session.commit()

    headers = auth_headers(marcos_superadmin.email, "marcos1234")

    users_response = client.get("/api/users/", headers=headers)
    trainers_response = client.get("/api/users/assignable-trainers", headers=headers)

    assert users_response.status_code == 200
    assert trainers_response.status_code == 200
    assert all(item["name"] != "Marcos" for item in trainers_response.json())
