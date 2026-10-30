"""Administrator API for persistent application settings."""

import os
import tempfile
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.config import Settings, settings
from app.models import User
from app.settings_store import (
    DATA_DIR,
    load_persisted_settings,
    load_secret_values,
    load_setting_values,
    save_secret_values,
    save_setting_values,
)
from app.utils.security import require_admin

router = APIRouter(prefix="/admin/settings", tags=["Admin Settings"])


SETTING_FIELDS = {
    "APP_NAME",
    "ACCESS_TOKEN_EXPIRE_MINUTES",
    "CORS_ORIGINS",
    "ADMIN_EMAILS",
    "NOTIFICATIONS_ENABLED",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_FROM",
    "SMTP_USE_TLS",
    "VAPID_PUBLIC_KEY",
    "VAPID_SUBJECT",
    "OPENROUTER_BASE_URL",
    "AI_DEFAULT_MODEL",
    "AI_MAX_OUTPUT_TOKENS",
    "AI_TURN_COST_CAP_USD",
    "AI_MONTHLY_CAP_USD",
    "AI_CHAT_MAX_TOOL_ROUNDS",
    "AI_FALLBACK_PRICE_IN_PER_M",
    "AI_FALLBACK_PRICE_OUT_PER_M",
    "BANK_SYNC_ENABLED",
    "EB_API_BASE",
    "EB_APPLICATION_ID",
    "EB_REDIRECT_URL",
    "EB_CONSENT_DAYS",
    "EB_INITIAL_HISTORY_DAYS",
    "EB_INCLUDE_PENDING",
    "EB_SYNC_OVERLAP_DAYS",
    "EB_MANUAL_SYNC_COOLDOWN_MINUTES",
    "EB_CONSENT_WARN_DAYS",
    "FRONTEND_BASE_URL",
    "LEGAL_OPERATOR_NAME",
    "LEGAL_CONTACT_EMAIL",
    "LEGAL_JURISDICTION",
    "PUBLIC_BASE_URL",
    "TRUST_PROXY_HEADERS",
    "RATE_LIMIT_PER_IP_MAX",
    "RATE_LIMIT_PER_IP_WINDOW_SECONDS",
    "RATE_LIMIT_PER_EMAIL_MAX",
    "RATE_LIMIT_PER_EMAIL_WINDOW_SECONDS",
}

SECRET_FIELDS = {
    "OPENROUTER_API_KEY",
    "SMTP_PASSWORD",
    "VAPID_PRIVATE_KEY",
}

# These changes are persisted immediately, but the current process cannot
# safely apply them to objects already created during application startup.
RESTART_REQUIRED_FIELDS = {
    "APP_NAME",
    "CORS_ORIGINS",
    "ADMIN_EMAILS",
}

BANK_FIELDS = {
    "BANK_SYNC_ENABLED",
    "EB_API_BASE",
    "EB_APPLICATION_ID",
    "EB_REDIRECT_URL",
    "EB_CONSENT_DAYS",
    "EB_INITIAL_HISTORY_DAYS",
    "EB_INCLUDE_PENDING",
    "EB_SYNC_OVERLAP_DAYS",
    "EB_MANUAL_SYNC_COOLDOWN_MINUTES",
    "EB_CONSENT_WARN_DAYS",
    "FRONTEND_BASE_URL",
}


class AdminSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    values: dict[str, Any] = Field(default_factory=dict)
    secrets: dict[str, str] = Field(default_factory=dict)
    clear_secrets: list[str] = Field(default_factory=list)


def _apply_runtime_settings(candidate: Settings) -> None:
    """Update the shared settings object imported by application modules."""
    for name in Settings.model_fields:
        if name not in RESTART_REQUIRED_FIELDS:
            settings.__dict__[name] = getattr(candidate, name)


def _build_candidate(
    values: dict[str, Any],
    secrets: dict[str, Any],
) -> Settings:
    try:
        return Settings(
            **{
                **settings.model_dump(),
                **load_persisted_settings(),
                **values,
                **secrets,
            }
        )
    except ValidationError as exc:
        messages = [
            f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
            for error in exc.errors()
        ]
        raise HTTPException(
            status_code=422,
            detail="; ".join(messages) or "Invalid settings",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _response() -> dict[str, Any]:
    stored = load_setting_values()

    values = {
        name: stored.get(name, getattr(settings, name))
        for name in SETTING_FIELDS
    }

    restart_required = sorted(
        name
        for name in RESTART_REQUIRED_FIELDS
        if name in stored and stored[name] != getattr(settings, name)
    )

    key_path = Path(settings.EB_PRIVATE_KEY_PATH) if settings.EB_PRIVATE_KEY_PATH else None

    return {
        "values": values,
        "secret_configured": {
            name: bool(getattr(settings, name))
            for name in SECRET_FIELDS
        },
        "protected_configured": {
            "SECRET_KEY": bool(settings.SECRET_KEY),
            "NOTIFICATION_ENCRYPTION_KEY": bool(settings.NOTIFICATION_ENCRYPTION_KEY),
        },
        "private_key_configured": bool(key_path and key_path.is_file()),
        "restart_required_fields": restart_required,
    }


@router.get("")
def get_admin_settings(admin: User = Depends(require_admin)):
    """Get editable settings and secret-presence flags. Never returns secrets."""
    return _response()


@router.put("")
def update_admin_settings(
    payload: AdminSettingsUpdate,
    admin: User = Depends(require_admin),
):
    unknown_values = set(payload.values) - SETTING_FIELDS
    unknown_secrets = set(payload.secrets) - SECRET_FIELDS
    unknown_clears = set(payload.clear_secrets) - SECRET_FIELDS

    if unknown_values or unknown_secrets or unknown_clears:
        unknown = sorted(unknown_values | unknown_secrets | unknown_clears)
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported settings: {', '.join(unknown)}",
        )

    stored_values = load_setting_values()
    stored_values.update(payload.values)

    stored_secrets = load_secret_values()
    for name, value in payload.secrets.items():
        if value:
            stored_secrets[name] = value

    for name in payload.clear_secrets:
        # Explicit null prevents an old environment value from reappearing.
        stored_secrets[name] = None

    candidate = _build_candidate(stored_values, stored_secrets)

    # Persist only after the complete candidate has passed Pydantic validation.
    save_setting_values(stored_values)
    save_secret_values(stored_secrets)
    _apply_runtime_settings(candidate)

    if set(payload.values) & BANK_FIELDS:
        from app.services.enable_banking_client import _token_cache
        _token_cache.clear()

    result = _response()
    result["saved"] = True
    return result


@router.post("/enable-banking/private-key")
async def upload_enable_banking_key(
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
):
    """Upload and validate an RSA PEM key without exposing its contents."""
    content = await file.read(65_537)
    if not content or len(content) > 65_536:
        raise HTTPException(status_code=413, detail="PEM file must be at most 64 KB")

    try:
        key = serialization.load_pem_private_key(content, password=None)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail="Invalid or encrypted PEM private key") from exc

    if not isinstance(key, RSAPrivateKey):
        raise HTTPException(status_code=422, detail="Enable Banking requires an RSA private key")

    directory = DATA_DIR / "secrets"
    directory.mkdir(parents=True, exist_ok=True)

    target = directory / "enablebanking.pem"
    fd, temporary_name = tempfile.mkstemp(prefix=".enablebanking.", dir=str(directory))
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())

        os.chmod(temporary_name, 0o600)
        os.replace(temporary_name, target)
        os.chmod(target, 0o600)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)

    stored_values = load_setting_values()
    stored_values["EB_PRIVATE_KEY_PATH"] = str(target)

    candidate = _build_candidate(stored_values, load_secret_values())
    save_setting_values(stored_values)
    _apply_runtime_settings(candidate)

    from app.services.enable_banking_client import _token_cache
    _token_cache.clear()

    return {"uploaded": True, "private_key_configured": True}


@router.delete("/enable-banking/private-key")
def delete_enable_banking_key(admin: User = Depends(require_admin)):
    """Remove the UI-managed key and disable bank sync."""
    target = DATA_DIR / "secrets" / "enablebanking.pem"

    stored_values = load_setting_values()
    stored_values["EB_PRIVATE_KEY_PATH"] = None
    stored_values["BANK_SYNC_ENABLED"] = False

    candidate = _build_candidate(stored_values, load_secret_values())

    if target.exists():
        target.unlink()

    save_setting_values(stored_values)
    _apply_runtime_settings(candidate)

    from app.services.enable_banking_client import _token_cache
    _token_cache.clear()

    return {"deleted": True, "private_key_configured": False}
