"""Test configuration and fixtures for backend tests.

Este módulo configura pytest para las pruebas de backend:
- Define una base de datos SQLite en memoria para pruebas aisladas
- Proporciona fixtures reutilizables (db_session, seed_data, client, auth_headers)
- Configura variables de entorno necesarias para JWT
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Añadir el directorio backend al path de Python para que pytest pueda importar app
sys.path.insert(0, str(Path(__file__).parent.parent))

# Configurar variables de entorno para los tests
# - DATABASE_URL: Apunta a una BD SQLite en memoria (no toca BD real)
# - JWT_SECRET_KEY: Clave secreta para firmar tokens JWT en tests
# - JWT_ALGORITHM: Algoritmo de firma (HS256 = HMAC con SHA256)
# - JWT_EXPIRE_MINUTES: Duración del token en tests
os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_bootstrap.db")
os.environ.setdefault("JWT_SECRET_KEY", "tests-secret-key")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("JWT_EXPIRE_MINUTES", "60")

# Importar modelos ANTES de crear fixtures (necesario para registrar tablas)
import app.models.booking  # noqa: F401
import app.models.center_rule  # noqa: F401
import app.models.session  # noqa: F401
import app.models.user  # noqa: F401
import app.models.weekly_schedule  # noqa: F401
import app.models.weekly_schedule_student  # noqa: F401
from app.auth.security import hash_password
from app.database.db import Base, get_db
from app.main import app
from app.models.session import SessionModel
from app.models.user import User

# Configuración de BD de prueba
# - SQLite en memoria (:) es rápido y aislado
# - Cada test obtiene una BD limpia (drop_all + create_all en fixture)
TEST_DATABASE_URL = "sqlite://"

# Motor SQLAlchemy para la BD de prueba
# - check_same_thread=False: Permite acceso desde threads de pytest
# - StaticPool: Mantiene una conexión única (ideal para tests en memoria)
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Factory para crear sesiones de BD en tests
# - autocommit=False: Los cambios se mantienen hasta hacer commit
# - autoflush=False: No flush automático de cambios
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
)


@pytest.fixture()
def db_session():
    """Fixture: Crea una BD limpia para cada test.
    
    Ciclo de vida:
    1. Borra todas las tablas (drop_all) - limpia datos anteriores
    2. Crea todas las tablas (create_all) - estructura nueva
    3. Proporciona sesión al test (yield)
    4. Cierra la sesión después del test (finally)
    
    Cada test obtiene una BD virgen => tests aislados e idempotentes
    """
    # Limpiar y recrear esquema de BD
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    
    # Crear sesión para este test
    session = TestingSessionLocal()
    try:
        # Proporcionar sesión al test
        yield session
    finally:
        # Limpiar después del test
        session.close()


@pytest.fixture()
def seed_data(db_session):
    """Fixture: Crea datos de prueba reutilizables.
    
    Crea 3 usuarios (admin, trainer, client) con:
    - Contraseñas hasheadas con bcrypt
    - Estados activos y membresía activa
    - IDs autogenerados por BD
    
    También crea 1 sesión asociada al trainer para tests de bookings.
    
    Retorna dict con referencias a estos objetos para uso en tests.
    Depende de: db_session (usa la BD limpia del test)
    """
    # Crear 3 usuarios con roles diferentes
    # Las contraseñas se almacenan en hash bcrypt (nunca en texto plano)
    admin = User(
        name="Admin",
        email="admin@example.com",
        password_hash=hash_password("admin1234"),
        role="admin",
        is_active=True,
        membership_active=True,
        is_verified=True,
    )
    trainer = User(
        name="Trainer",
        email="trainer@example.com",
        password_hash=hash_password("trainer1234"),
        role="trainer",
        is_active=True,
        membership_active=True,
        is_verified=True,
    )
    client = User(
        name="Client",
        email="client@example.com",
        password_hash=hash_password("client1234"),
        role="client",
        is_active=True,
        membership_active=True,
        is_verified=True,
    )

    # Guardar usuarios en BD y obtener sus IDs autogenerados
    db_session.add_all([admin, trainer, client])
    db_session.commit()  # Persistir en BD
    
    # refresh: Recargar desde BD para obtener IDs asignados por autoincrement
    db_session.refresh(admin)
    db_session.refresh(trainer)
    db_session.refresh(client)

    # Crear una sesión (clase SessionModel, no sesión SQLAlchemy)
    # para tests que requieren una sesión existente (clave foránea)
    session = SessionModel(
        trainer_id=trainer.id,
        start_time=datetime.now(timezone.utc) + timedelta(days=1),
        end_time=datetime.now(timezone.utc) + timedelta(days=1, hours=1),
        capacity=8,
        status="active",
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    # Retornar dict con todas las referencias para acceso en tests
    return {
        "admin": admin,
        "trainer": trainer,
        "client": client,
        "session": session,
    }


@pytest.fixture()
def client(db_session):
    """Fixture: Cliente HTTP para hacer peticiones a la API.
    
    Pasos clave:
    1. override_get_db: Función que reemplaza el get_db original
       - FastAPI usa get_db para inyectar la sesión de BD en endpoints
       - En tests, queremos usar db_session (BD en memoria) en lugar de la real
       - Override de dependencias: FastAPI permite reemplazar dependencias
    
    2. app.dependency_overrides[get_db]: Reemplaza la dependencia get_db
       - Cualquier endpoint que use Depends(get_db) recibirá db_session
    
    3. TestClient(app): Cliente HTTP para simular peticiones
       - Permite enviar GET/POST/etc sin levantar servidor real
       - Las peticiones usan la BD en memoria
    
    Resultado: Tests pueden llamar endpoints directamente con BD aislada
    """
    # Función override que proporciona la BD de test en lugar de la real
    def override_get_db():
        try:
            # FastAPI inyectará db_session en lugar de la BD real
            yield db_session
        finally:
            pass  # No cerrar, db_session se cierra en fixture después

    # Registrar el override en FastAPI
    app.dependency_overrides[get_db] = override_get_db
    
    # Retornar cliente de prueba
    return TestClient(app)


@pytest.fixture()
def auth_headers(client):
    """Fixture: Helper para autenticar usuarios en tests.
    
    Retorna una función que:
    1. Hace POST a /api/auth/login con email y contraseña
    2. Extrae el JWT del response
    3. Retorna headers de Authorization con el token
    
    Uso en tests:
        headers = auth_headers(email, password)
        response = client.get("/ruta-protegida", headers=headers)
    
    Depende de: client (necesita cliente HTTP)
    """
    def _auth_headers(email, password):
        # Autenticarse contra el endpoint /api/auth/login
        response = client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )
        
        # Extraer el JWT del response
        token = response.json()["access_token"]
        
        # Retornar headers con token Bearer (formato: Bearer <token>)
        return {"Authorization": f"Bearer {token}"}

    return _auth_headers