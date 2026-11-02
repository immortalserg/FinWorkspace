"""Per-user encrypted Paperless connection settings.

This module only stores configuration; no outbound requests are made here.
"""
import json
import os
import tempfile
from pathlib import Path

from app.config import settings
from app.utils import crypto


def _path(user_id: int) -> Path:
    return Path(settings.DOCUMENTS_DIR) / str(int(user_id)) / "_paperless.json"


def read_connection(user_id: int) -> dict | None:
    path = _path(user_id)
    if not path.is_file():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return {"url": data["url"], "token": crypto.decrypt(data["token_encrypted"])}


def connection_status(user_id: int) -> dict:
    path = _path(user_id)
    if not path.is_file():
        return {"configured": False, "url": None}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {"configured": True, "url": data["url"]}


def save_connection(user_id: int, url: str, token: str) -> None:
    path = _path(user_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps({"url": url, "token_encrypted": crypto.encrypt(token)})
    fd, temporary = tempfile.mkstemp(prefix=".paperless-", dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(payload)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def delete_connection(user_id: int) -> None:
    _path(user_id).unlink(missing_ok=True)
