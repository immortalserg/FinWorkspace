"""Authenticated Paperless integration endpoints.

Only origins explicitly approved by the server administrator are reachable.
Set PAPERLESS_ALLOWED_ORIGINS as a comma-separated list of HTTP(S) origins.
"""
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services.paperless_client import PaperlessClient, PaperlessError
from app.services import paperless_connection as store
from app.utils.crypto import DecryptionError
from app.utils.security import get_current_user_authenticated as get_current_user

router = APIRouter(prefix="/paperless", tags=["Paperless"])


class ConnectionInput(BaseModel):
    url: str = Field(min_length=8, max_length=512)
    token: str = Field(min_length=1, max_length=1024)


def _approved(url: str) -> bool:
    allowed = {s.strip().rstrip("/") for s in os.environ.get(
        "PAPERLESS_ALLOWED_ORIGINS", "").split(",") if s.strip()}
    return bool(allowed) and url.rstrip("/") in allowed


def _client(user: User) -> PaperlessClient:
    try:
        saved = store.read_connection(user.id)
    except (DecryptionError, ValueError, KeyError, OSError):
        raise HTTPException(409, "Paperless credentials need to be configured again")
    if not saved:
        raise HTTPException(404, "Paperless connection not configured")
    if not _approved(saved["url"]):
        raise HTTPException(403, "Paperless origin is not approved by the administrator")
    return PaperlessClient(saved["url"], saved["token"])


def _error(exc: PaperlessError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=str(exc))


@router.get("/connection")
def get_connection(user: User = Depends(get_current_user)):
    return store.connection_status(user.id)


@router.put("/connection")
def set_connection(payload: ConnectionInput, user: User = Depends(get_current_user)):
    try:
        client = PaperlessClient(payload.url, payload.token)
    except ValueError:
        raise HTTPException(422, "Invalid Paperless URL or token")
    if not _approved(client.base_url):
        raise HTTPException(403, "Paperless origin is not approved by the administrator")
    store.save_connection(user.id, client.base_url, payload.token)
    return store.connection_status(user.id)


@router.delete("/connection", status_code=204)
def remove_connection(user: User = Depends(get_current_user)):
    store.delete_connection(user.id)


@router.get("/test")
async def test_connection(user: User = Depends(get_current_user)):
    try:
        result = await _client(user).list("tags", params={"page_size": 1})
        return {"connected": True, "count": result.get("count") if isinstance(result, dict) else None}
    except PaperlessError as exc:
        raise _error(exc)


@router.get("/tasks")
async def list_tasks(user: User = Depends(get_current_user)):
    try:
        return await _client(user).tasks()
    except PaperlessError as exc:
        raise _error(exc)


@router.get("/{resource}")
async def list_resource(resource: str, user: User = Depends(get_current_user)):
    try:
        return await _client(user).list(resource)
    except ValueError:
        raise HTTPException(404, "Unknown Paperless resource")
    except PaperlessError as exc:
        raise _error(exc)


@router.post("/{resource}")
async def create_resource(resource: str, payload: dict, user: User = Depends(get_current_user)):
    try:
        return await _client(user).create(resource, payload)
    except ValueError:
        raise HTTPException(404, "Unknown Paperless resource")
    except PaperlessError as exc:
        raise _error(exc)


@router.patch("/{resource}/{item_id}")
async def update_resource(resource: str, item_id: int, payload: dict,
                          user: User = Depends(get_current_user)):
    try:
        return await _client(user).update(resource, item_id, payload)
    except ValueError:
        raise HTTPException(404, "Unknown Paperless resource")
    except PaperlessError as exc:
        raise _error(exc)
