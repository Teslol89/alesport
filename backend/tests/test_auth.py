def test_login_returns_access_token(client, seed_data):
    response = client.post(
        "/auth/login",
        json={"email": seed_data["client"].email, "password": "client1234"},
    )

    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_rejects_invalid_credentials(client, seed_data):
    response = client.post(
        "/auth/login",
        json={"email": seed_data["client"].email, "password": "bad-password"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Correo o contraseña incorrectos"


def test_auth_me_requires_token(client):
    response = client.get("/auth/me")

    assert response.status_code == 401


def test_auth_me_returns_authenticated_user_profile(client, auth_headers, seed_data):
    headers = auth_headers(seed_data["client"].email, "client1234")

    response = client.get("/auth/me", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == seed_data["client"].email
    assert body["role"] == "client"
    assert body["is_active"] is True