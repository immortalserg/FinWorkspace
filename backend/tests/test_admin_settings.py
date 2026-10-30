import stat

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

import app.settings_store as settings_store
import app.routers.admin_settings as admin_settings


@pytest.fixture
def admin_client(client, seed_user, db):
    seed_user.is_admin = True
    db.commit()
    return client


@pytest.fixture
def isolated_settings_files(monkeypatch, tmp_path):
    monkeypatch.setattr(settings_store, "DATA_DIR", tmp_path)
    monkeypatch.setattr(
        settings_store, "SETTINGS_FILE", tmp_path / "app-settings.json"
    )
    monkeypatch.setattr(
        settings_store, "SECRETS_FILE", tmp_path / "app-secrets.json"
    )
    monkeypatch.setattr(
        settings_store, "KEY_FILE", tmp_path / "app-settings.key"
    )
    monkeypatch.setattr(admin_settings, "DATA_DIR", tmp_path)
    return tmp_path


def test_settings_require_admin(client):
    response = client.get("/api/admin/settings")
    assert response.status_code == 403


def test_settings_response_never_exposes_secrets(
    admin_client, isolated_settings_files, monkeypatch
):
    secret = "test-secret-that-must-never-be-returned"
    monkeypatch.setattr(
        admin_settings.settings, "OPENROUTER_API_KEY", secret
    )

    response = admin_client.get("/api/admin/settings")

    assert response.status_code == 200
    assert secret not in response.text
    assert response.json()["secret_configured"]["OPENROUTER_API_KEY"] is True


def test_update_persists_settings_and_encrypts_secrets(
    admin_client, isolated_settings_files, monkeypatch
):
    secret = "test-openrouter-api-key-12345"
    monkeypatch.setattr(
        admin_settings.settings, "OPENROUTER_API_KEY", None
    )

    response = admin_client.put(
        "/api/admin/settings",
        json={
            "values": {
                "APP_NAME": "HomeFinance Test",
            },
            "secrets": {
                "OPENROUTER_API_KEY": secret,
            },
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["saved"] is True
    assert data["values"]["APP_NAME"] == "HomeFinance Test"
    assert data["secret_configured"]["OPENROUTER_API_KEY"] is True
    assert secret not in response.text

    settings_file = isolated_settings_files / "app-settings.json"
    secrets_file = isolated_settings_files / "app-secrets.json"
    key_file = isolated_settings_files / "app-settings.key"

    assert settings_file.is_file()
    assert secrets_file.is_file()
    assert key_file.is_file()

    encrypted_data = secrets_file.read_text()
    assert secret not in encrypted_data
    assert "enc:v1:" in encrypted_data

    assert stat.S_IMODE(key_file.stat().st_mode) == 0o600
    assert stat.S_IMODE(secrets_file.stat().st_mode) == 0o600


def test_invalid_pem_is_rejected(
    admin_client, isolated_settings_files
):
    response = admin_client.post(
        "/api/admin/settings/enable-banking/private-key",
        files={
            "file": (
                "invalid.pem",
                b"this is not a PEM private key",
                "application/x-pem-file",
            )
        },
    )

    assert response.status_code == 422
    assert not (
        isolated_settings_files / "secrets" / "enablebanking.pem"
    ).exists()


def test_upload_and_delete_enable_banking_key(
    admin_client, isolated_settings_files, monkeypatch
):
    monkeypatch.setattr(
        admin_settings.settings, "EB_PRIVATE_KEY_PATH", None
    )

    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    pem_data = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    )

    response = admin_client.post(
        "/api/admin/settings/enable-banking/private-key",
        files={
            "file": (
                "enablebanking.pem",
                pem_data,
                "application/x-pem-file",
            )
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["uploaded"] is True
    assert response.json()["private_key_configured"] is True

    key_path = (
        isolated_settings_files / "secrets" / "enablebanking.pem"
    )
    assert key_path.is_file()
    assert stat.S_IMODE(key_path.stat().st_mode) == 0o600

    response = admin_client.delete(
        "/api/admin/settings/enable-banking/private-key"
    )

    assert response.status_code == 200, response.text
    assert response.json()["deleted"] is True
    assert response.json()["private_key_configured"] is False
    assert not key_path.exists()
