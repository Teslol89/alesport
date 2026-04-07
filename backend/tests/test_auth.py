def test_login_returns_access_token(client, seed_data):
    """Test: El endpoint /api/auth/login retorna un JWT válido.
    
    Verifica:
    - Status 200 (exitoso)
    - Response contiene 'access_token'
    - token_type es 'bearer'
    
    Fixtures usadas:
    - client: Cliente HTTP para hacer POST
    - seed_data: Proporciona usuario "client" con email/contraseña
    """
    # Hacer POST a /api/auth/login con credenciales válidas
    response = client.post(
        "/api/auth/login",
        json={"email": seed_data["client"].email, "password": "client1234"},
    )

    # Verificar que fue exitoso (200 OK)
    assert response.status_code == 200
    
    # Extraer body JSON
    body = response.json()
    
    # Verificar estructura del response
    assert "access_token" in body  # JWT token presente
    assert body["token_type"] == "bearer"  # Tipo OAuth2 correcto


def test_login_rejects_invalid_credentials(client, seed_data):
    """Test: El endpoint /api/auth/login rechaza contraseñas incorrectas.
    
    Verifica:
    - Status 401 (Unauthorized)
    - Mensaje de error apropiado
    
    Seguridad: Cuando la contraseña es incorrecta, el servidor rechaza
    (no debe revelar si el email existe o no => previene enumeración)
    """
    # Intentar login con contraseña incorrecta
    response = client.post(
        "/api/auth/login",
        json={"email": seed_data["client"].email, "password": "bad-password"},
    )

    # Verificar que fue rechazado (401 Unauthorized)
    assert response.status_code == 401
    
    # Verificar mensaje de error
    assert response.json()["detail"] == "Correo o contraseña incorrectos"


def test_auth_me_requires_token(client):
    """Test: El endpoint /api/auth/me requiere JWT en header Authorization.
    
    Verifica:
    - Status 401 (Unauthorized)
    
    Seguridad: Endpoint protegido sin token -> rechazo
    (Middleware de autenticación lo valida)
    """
    # GET a /api/auth/me SIN headers -> no hay token
    response = client.get("/api/auth/me")

    # Verificar que fue rechazado
    assert response.status_code == 401


def test_auth_me_returns_authenticated_user_profile(client, auth_headers, seed_data):
    """Test: El endpoint /api/auth/me retorna el perfil del usuario autenticado.
    
    Flujo:
    1. auth_headers(): Hace login y obtiene JWT
    2. GET /api/auth/me con JWT en header
    3. Servidor verifica JWT y retorna user profile
    
    Verifica:
    - Status 200 (exitoso)
    - Email retornado coincide con usuario autenticado
    - Role es correcto
    - Usuario está activo
    
    Esto demuestra que JWT es válido y que el decoder extrae el user_id correctamente.
    """
    # Obtener headers con JWT válido
    headers = auth_headers(seed_data["client"].email, "client1234")

    # GET /api/auth/me con headers de autorización
    response = client.get("/api/auth/me", headers=headers)

    # Verificar que fue exitoso
    assert response.status_code == 200
    
    # Verificar datos retornados
    body = response.json()
    assert body["email"] == seed_data["client"].email  # Email correcto
    assert body["role"] == "client"  # Role correcto
    assert body["is_active"] is True  # Usuario activo


def test_users_me_patch_updates_name_and_phone(client, auth_headers, seed_data):
    """Test: El endpoint PATCH /api/users/me actualiza el perfil del usuario autenticado."""
    headers = auth_headers(seed_data["client"].email, "client1234")

    response = client.patch(
        "/api/users/me",
        headers=headers,
        json={"name": "Cliente Editado", "phone": "+34 600123456"},
    )

    assert response.status_code == 200

    body = response.json()
    assert body["name"] == "Cliente Editado"
    assert body["phone"] == "+34 600123456"