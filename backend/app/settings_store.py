"""Persistent application settings with encrypted secrets."""

import json
import os
import tempfile
from pathlib import Path
from threading import RLock
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(
    os.environ.get("APP_DATA_DIR", str(PROJECT_ROOT / "data"))
).resolve()

SETTINGS_FILE = DATA_DIR / "app-settings.json"
SECRETS_FILE = DATA_DIR / "app-secrets.json"
KEY_FILE = DATA_DIR / "app-settings.key"

_lock = RLock()
_ENCRYPTED_PREFIX = "enc:v1:"


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(
            f"Cannot read application settings file: {path.name}"
        ) from exc

    if not isinstance(data, dict):
        raise RuntimeError(f"Invalid application settings format: {path.name}")

    return data


def _write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    fd, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=str(path.parent),
    )

    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(data, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())

        os.chmod(temporary_name, 0o600)
        os.replace(temporary_name, path)
        os.chmod(path, 0o600)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)


def _get_fernet(*, allow_create_with_existing_secrets: bool = False) -> Fernet:
    """Load or generate a dedicated encryption key with restrictive permissions."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if not KEY_FILE.exists():
        # An empty file or null-only secrets do not contain encrypted data.
        if SECRETS_FILE.exists() and not allow_create_with_existing_secrets:
            existing = _read_json(SECRETS_FILE)
            has_encrypted_data = any(
                isinstance(value, str) and value.startswith(_ENCRYPTED_PREFIX)
                for value in existing.values()
            )
            if has_encrypted_data:
                raise RuntimeError(
                    "Application settings encryption key is missing. "
                    "Restore app-settings.key from backup."
                )

        key = Fernet.generate_key()

        try:
            fd = os.open(
                KEY_FILE,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL,
                0o600,
            )
            with os.fdopen(fd, "wb") as stream:
                stream.write(key)
                stream.flush()
                os.fsync(stream.fileno())
        except FileExistsError:
            key = KEY_FILE.read_bytes().strip()
    else:
        key = KEY_FILE.read_bytes().strip()

    os.chmod(KEY_FILE, 0o600)

    try:
        return Fernet(key)
    except (ValueError, TypeError) as exc:
        raise RuntimeError("Application settings encryption key is invalid") from exc


def _write_secret_values(
    values: dict[str, Any], *, allow_create_key: bool = False
) -> None:
    encoded: dict[str, Any] = {}

    for name, value in values.items():
        if value is None:
            encoded[name] = None
        elif isinstance(value, str):
            fernet = _get_fernet(
                allow_create_with_existing_secrets=allow_create_key
            )
            encrypted = fernet.encrypt(value.encode("utf-8")).decode("ascii")
            encoded[name] = _ENCRYPTED_PREFIX + encrypted
        else:
            raise TypeError(f"Secret {name} must be a string or null")

    _write_json(SECRETS_FILE, encoded)


def _read_secret_values() -> dict[str, Any]:
    raw = _read_json(SECRETS_FILE)
    if not raw:
        return {}

    result: dict[str, Any] = {}
    legacy_found = False

    for name, value in raw.items():
        if value is None:
            result[name] = None
            continue

        if not isinstance(value, str):
            raise RuntimeError(f"Invalid secret value in {SECRETS_FILE.name}")

        if not value.startswith(_ENCRYPTED_PREFIX):
            # Migrate values written by the first settings-store implementation.
            result[name] = value
            legacy_found = True
            continue

        try:
            token = value[len(_ENCRYPTED_PREFIX):].encode("ascii")
            result[name] = _get_fernet().decrypt(token).decode("utf-8")
        except (InvalidToken, UnicodeDecodeError, ValueError) as exc:
            raise RuntimeError(
                f"Cannot decrypt application secret: {name}. "
                "Check that app-settings.key matches the backup."
            ) from exc

    if legacy_found:
        _write_secret_values(result, allow_create_key=legacy_found)

    return result


def load_setting_values() -> dict[str, Any]:
    with _lock:
        return _read_json(SETTINGS_FILE)


def load_secret_values() -> dict[str, Any]:
    with _lock:
        return _read_secret_values()


def load_persisted_settings() -> dict[str, Any]:
    """Load ordinary settings and decrypted secrets for internal application use."""
    with _lock:
        return {
            **_read_json(SETTINGS_FILE),
            **_read_secret_values(),
        }


def save_setting_values(values: dict[str, Any]) -> None:
    with _lock:
        _write_json(SETTINGS_FILE, values)


def save_secret_values(values: dict[str, Any]) -> None:
    with _lock:
        _write_secret_values(values)
