import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Add backend directory to path so 'app' module can be imported
sys.path.insert(0, str(Path(__file__).parent.parent))

os.environ.setdefault("DATABASE_URL", "sqlite:///./tests_bootstrap.db")
os.environ.setdefault("JWT_SECRET_KEY", "tests-secret-key")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("JWT_EXPIRE_MINUTES", "60")

import app.models.booking  # noqa: F401
import app.models.session  # noqa: F401
import app.models.user  # noqa: F401
import app.models.weekly_schedule  # noqa: F401
from app.auth.security import hash_password
from app.database.db import Base, get_db
from app.main import app
from app.models.session import SessionModel
from app.models.user import User


TEST_DATABASE_URL = "sqlite://"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
)


@pytest.fixture()
def db_session():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def seed_data(db_session):
    admin = User(
        name="Admin",
        email="admin@example.com",
        password_hash=hash_password("admin1234"),
        role="admin",
        is_active=True,
        membership_active=True,
    )
    trainer = User(
        name="Trainer",
        email="trainer@example.com",
        password_hash=hash_password("trainer1234"),
        role="trainer",
        is_active=True,
        membership_active=True,
    )
    client = User(
        name="Client",
        email="client@example.com",
        password_hash=hash_password("client1234"),
        role="client",
        is_active=True,
        membership_active=True,
    )

    db_session.add_all([admin, trainer, client])
    db_session.commit()
    db_session.refresh(admin)
    db_session.refresh(trainer)
    db_session.refresh(client)

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

    return {
        "admin": admin,
        "trainer": trainer,
        "client": client,
        "session": session,
    }


@pytest.fixture()
def client(seed_data):
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client):
    def _login(email: str, password: str) -> dict[str, str]:
        response = client.post(
            "/auth/login",
            json={"email": email, "password": password},
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _login