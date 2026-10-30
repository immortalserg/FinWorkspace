import json
import os

from app import settings_store as store


def configure_temp_store(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "DATA_DIR", tmp_path)
    monkeypatch.setattr(store, "SETTINGS_FILE", tmp_path / "app-settings.json")
    monkeypatch.setattr(store, "SECRETS_FILE", tmp_path / "app-secrets.json")
    monkeypatch.setattr(store, "KEY_FILE", tmp_path / "app-settings.key")


def test_secrets_are_encrypted_at_rest(tmp_path, monkeypatch):
    configure_temp_store(tmp_path, monkeypatch)

    store.save_secret_values({
        "OPENROUTER_API_KEY": "secret-token-123",
        "SMTP_PASSWORD": "mail-password",
    })

    content = store.SECRETS_FILE.read_text(encoding="utf-8")

    assert "secret-token-123" not in content
    assert "mail-password" not in content
    assert content.count("enc:v1:") == 2

    assert store.load_secret_values() == {
        "OPENROUTER_API_KEY": "secret-token-123",
        "SMTP_PASSWORD": "mail-password",
    }

    assert os.stat(store.SECRETS_FILE).st_mode & 0o777 == 0o600
    assert os.stat(store.KEY_FILE).st_mode & 0o777 == 0o600


def test_legacy_plaintext_secrets_are_migrated(tmp_path, monkeypatch):
    configure_temp_store(tmp_path, monkeypatch)

    store.SECRETS_FILE.write_text(
        json.dumps({"OPENROUTER_API_KEY": "legacy-secret"}),
        encoding="utf-8",
    )

    assert store.load_secret_values() == {
        "OPENROUTER_API_KEY": "legacy-secret"
    }

    migrated = store.SECRETS_FILE.read_text(encoding="utf-8")
    assert "legacy-secret" not in migrated
    assert "enc:v1:" in migrated


def test_null_secret_can_override_environment(tmp_path, monkeypatch):
    configure_temp_store(tmp_path, monkeypatch)

    store.save_secret_values({"SMTP_PASSWORD": None})

    assert store.load_secret_values() == {"SMTP_PASSWORD": None}


def test_settings_and_secrets_are_merged(tmp_path, monkeypatch):
    configure_temp_store(tmp_path, monkeypatch)

    store.save_setting_values({"AI_DEFAULT_MODEL": "test/model"})
    store.save_secret_values({"OPENROUTER_API_KEY": "test-secret"})

    assert store.load_persisted_settings() == {
        "AI_DEFAULT_MODEL": "test/model",
        "OPENROUTER_API_KEY": "test-secret",
    }


def test_first_secret_can_be_saved_after_empty_settings_file(tmp_path, monkeypatch):
    configure_temp_store(tmp_path, monkeypatch)

    store.save_secret_values({})
    assert store.SECRETS_FILE.exists()
    assert not store.KEY_FILE.exists()

    store.save_secret_values({"OPENROUTER_API_KEY": "first-secret"})

    assert store.load_secret_values() == {
        "OPENROUTER_API_KEY": "first-secret"
    }
    assert store.KEY_FILE.exists()
