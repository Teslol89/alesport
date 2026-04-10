def test_authenticated_user_can_read_center_rules(client, auth_headers, seed_data):
    """Cualquier usuario autenticado puede consultar las normas compartidas del centro."""
    headers = auth_headers(seed_data["client"].email, "client1234")

    response = client.get("/api/center-rules/", headers=headers)

    assert response.status_code == 200
    assert response.json() == {"rules": []}


def test_admin_can_update_center_rules_and_clients_see_them(client, auth_headers, seed_data):
    """Cuando el admin actualiza las normas, todos los clientes deben ver las mismas."""
    admin_headers = auth_headers(seed_data["admin"].email, "admin1234")
    client_headers = auth_headers(seed_data["client"].email, "client1234")
    payload = {
        "rules": [
            "Llega con 5 minutos de antelación.",
            "Trae toalla y agua a cada sesión.",
        ]
    }

    update_response = client.put("/api/center-rules/", headers=admin_headers, json=payload)

    assert update_response.status_code == 200
    assert update_response.json() == payload

    read_response = client.get("/api/center-rules/", headers=client_headers)

    assert read_response.status_code == 200
    assert read_response.json() == payload


def test_non_admin_cannot_update_center_rules(client, auth_headers, seed_data):
    """Solo el administrador puede guardar cambios en las normas del centro."""
    headers = auth_headers(seed_data["client"].email, "client1234")

    response = client.put(
        "/api/center-rules/",
        headers=headers,
        json={"rules": ["Norma de prueba"]},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Solo administradores pueden actualizar las normas del centro"
