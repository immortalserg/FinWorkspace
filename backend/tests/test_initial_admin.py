import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main
from app.database import Base
from app.models import User
from app.utils.security import verify_password


@pytest.fixture
def isolated_database(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )
    monkeypatch.setattr(main, "SessionLocal", TestingSessionLocal)

    try:
        yield TestingSessionLocal
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def configure_initial_admin(monkeypatch, email, name, password):
    monkeypatch.setattr(main.settings, "INITIAL_ADMIN_EMAIL", email)
    monkeypatch.setattr(main.settings, "INITIAL_ADMIN_NAME", name)
    monkeypatch.setattr(main.settings, "INITIAL_ADMIN_PASSWORD", password)


def test_creates_initial_admin_in_empty_database(
    isolated_database, monkeypatch
):
    configure_initial_admin(
        monkeypatch,
        "Admin@Example.com",
        "Initial Admin",
        "Secure-Test-Password-123",
    )

    main._bootstrap_initial_admin(main.logging.getLogger("test"))

    with isolated_database() as db:
        users = db.query(User).all()
        assert len(users) == 1

        user = users[0]
        assert user.email == "admin@example.com"
        assert user.full_name == "Initial Admin"
        assert user.is_admin is True
        assert user.is_active is True
        assert user.email_verified is True
        assert user.hashed_password != "Secure-Test-Password-123"
        assert verify_password(
            "Secure-Test-Password-123", user.hashed_password
        )


def test_does_not_change_existing_users(isolated_database, monkeypatch):
    configure_initial_admin(
        monkeypatch,
        "new-admin@example.com",
        "New Admin",
        "Secure-Test-Password-123",
    )

    with isolated_database() as db:
        existing = User(
            email="existing@example.com",
            full_name="Existing User",
            hashed_password="existing-hash",
            is_admin=False,
            is_active=True,
            email_verified=False,
        )
        db.add(existing)
        db.commit()
        existing_id = existing.id

    main._bootstrap_initial_admin(main.logging.getLogger("test"))

    with isolated_database() as db:
        users = db.query(User).all()
        assert len(users) == 1
        assert users[0].id == existing_id
        assert users[0].email == "existing@example.com"
        assert users[0].hashed_password == "existing-hash"
        assert users[0].is_admin is False
        assert users[0].email_verified is False


@pytest.mark.parametrize(
    ("email", "name", "password"),
    [
        ("", "Initial Admin", "Secure-Test-Password-123"),
        ("admin@example.com", "", "Secure-Test-Password-123"),
        ("admin@example.com", "Initial Admin", ""),
    ],
)
def test_does_not_create_admin_with_incomplete_configuration(
    isolated_database, monkeypatch, email, name, password
):
    configure_initial_admin(monkeypatch, email, name, password)

    main._bootstrap_initial_admin(main.logging.getLogger("test"))

    with isolated_database() as db:
        assert db.query(User).count() == 0
