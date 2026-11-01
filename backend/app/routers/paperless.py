"""Authenticated Paperless integration endpoints.

The administrator configures one shared Paperless endpoint and encrypted token.
"""

from fastapi import APIRouter, Depends, HTTPException, File, Form, UploadFile, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services.paperless_client import PaperlessClient, PaperlessError
from app.services import paperless_connection as store
from app.utils.crypto import DecryptionError
from app.utils.security import get_current_user_authenticated as get_current_user, require_admin

router = APIRouter(prefix="/paperless", tags=["Paperless"])


class ConnectionInput(BaseModel):
    url: str = Field(min_length=8, max_length=512)
    token: str = Field(min_length=1, max_length=1024)


def _client(user: User) -> PaperlessClient:
    try:
        saved = store.read_connection(0)
        if not saved:
            # Backwards compatibility with previously configured per-user connections.
            saved = store.read_connection(user.id)
    except (DecryptionError, ValueError, KeyError, OSError):
        raise HTTPException(409, "Paperless credentials need to be configured again")
    if not saved:
        raise HTTPException(404, "Paperless connection not configured")
    return PaperlessClient(saved["url"], saved["token"])


def _error(exc: PaperlessError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=str(exc))


@router.get("/connection")
def get_connection(user: User = Depends(get_current_user)):
    return store.connection_status(0)


@router.put("/connection")
def set_connection(payload: ConnectionInput, user: User = Depends(require_admin)):
    try:
        client = PaperlessClient(payload.url, payload.token)
    except ValueError:
        raise HTTPException(422, "Invalid Paperless URL or token")
    store.save_connection(0, client.base_url, payload.token)
    return store.connection_status(user.id)


@router.delete("/connection", status_code=204)
def remove_connection(user: User = Depends(require_admin)):
    store.delete_connection(0)


@router.get("/test")
async def test_connection(user: User = Depends(get_current_user)):
    try:
        result = await _client(user).list("tags", params={"page_size": 1})
        return {"connected": True, "count": result.get("count") if isinstance(result, dict) else None}
    except PaperlessError as exc:
        raise _error(exc)


@router.post("/upload")
async def upload_to_paperless(
    file: UploadFile = File(...),
    metadata: str = Form("{}"),
    user: User = Depends(get_current_user),
):
    import json
    from app.config import settings

    try:
        attrs = json.loads(metadata)
    except (TypeError, ValueError):
        raise HTTPException(422, "Invalid document metadata")
    if not isinstance(attrs, dict):
        raise HTTPException(422, "Document metadata must be an object")
    allowed = {"title", "created", "correspondent", "document_type",
               "storage_path", "tags", "archive_serial_number", "custom_fields"}
    if not attrs.keys() <= allowed:
        raise HTTPException(422, "Unsupported document metadata")
    limit = settings.DOCUMENTS_MAX_FILE_SIZE
    content = await file.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(413, "Document exceeds size limit")
    if not content:
        raise HTTPException(422, "Empty document")
    try:
        task_id = await _client(user).upload(
            file.filename or "document", content,
            content_type=file.content_type or "application/octet-stream",
            metadata=attrs,
        )
        return {"task_id": task_id}
    except PaperlessError as exc:
        raise _error(exc)



# Copy operations never remove the source document.
@router.post("/copy-from-local/{doc_id}")
async def copy_from_local(doc_id: str, user: User = Depends(get_current_user)):
    from app.routers import documents as local
    from pathlib import Path
    index = local._load_index(user.id)
    doc = local._get_doc(index["documents"], doc_id)
    if not doc:
        raise HTTPException(404, "Local document not found")
    path = local._user_dir(user.id) / doc["stored_name"]
    if not path.is_file():
        raise HTTPException(404, "Local file missing")
    from app.config import settings
    if path.stat().st_size > settings.DOCUMENTS_MAX_FILE_SIZE:
        raise HTTPException(413, "Document exceeds size limit")
    client = _client(user)
    meta = doc.get("paperless_metadata") or {}
    attrs = {"title": doc["title"]}
    # Local references are names; Paperless expects integer IDs.
    for resource, field in (("document_types", "document_type"),
                            ("correspondents", "correspondent"),
                            ("storage_paths", "storage_path")):
        name = meta.get(field)
        if name:
            result = await client.list(resource, params={"page_size": 100})
            item = next((v for v in result.get("results", [])
                         if v["name"].casefold() == str(name).casefold()), None)
            if not item:
                item = await client.create(resource, {"name": name})
            attrs[field] = item["id"]
    if meta.get("tags"):
        result = await client.list("tags", params={"page_size": 100})
        known = {v["name"].casefold(): v["id"] for v in result.get("results", [])}
        attrs["tags"] = []
        for name in meta["tags"]:
            tag_id = known.get(name.casefold())
            if tag_id is None:
                created = await client.create("tags", {"name": name})
                tag_id = created["id"]
                known[name.casefold()] = tag_id
            attrs["tags"].append(tag_id)
    for key in ("created", "archive_serial_number"):
        if meta.get(key):
            attrs[key] = meta[key]
    # Do not silently discard local custom-field values.
    if meta.get("custom_fields"):
        raise HTTPException(422, "Custom field mapping is not yet supported for copying to Paperless")
    try:
        task = await client.upload(doc["filename"], path.read_bytes(),
                                   content_type=doc.get("mime_type") or "application/octet-stream",
                                   metadata=attrs)
        return {"task_id": task, "message": "Document submitted to Paperless for processing"}
    except PaperlessError as exc:
        raise _error(exc)


@router.post("/copy-to-local/{item_id}")
async def copy_to_local(item_id: int, user: User = Depends(get_current_user)):
    from app.routers import documents as local
    from app.config import settings
    from pathlib import Path
    from datetime import datetime, timezone
    import mimetypes
    import uuid
    client = _client(user)
    try:
        doc = await client.get("documents", item_id)
        content = await client.download(item_id)
        if not content or len(content) > settings.DOCUMENTS_MAX_FILE_SIZE:
            raise HTTPException(413, "Downloaded document is empty or exceeds local size limit")
        filename = Path(doc.get("original_file_name") or doc.get("filename") or f"paperless-{item_id}.pdf").name
        suffix = Path(filename).suffix.lower()
        if suffix not in local.ALLOWED_EXTENSIONS:
            raise HTTPException(415, f"Local storage does not support {suffix}")
        metadata = {}
        definitions = {}
        for resource, field in (("document_types", "document_type"),
                                ("correspondents", "correspondent"),
                                ("storage_paths", "storage_path")):
            ref = doc.get(field)
            if ref:
                entry = await client.get(resource, ref)
                metadata[field] = entry["name"]
                definitions[resource] = [entry]
        tags = []
        for ref in doc.get("tags") or []:
            entry = await client.get("tags", ref)
            tags.append(entry["name"])
        metadata["tags"] = tags
        if tags:
            definitions["tags"] = [{"name": name} for name in tags]
        for field in ("created", "archive_serial_number"):
            if doc.get(field) is not None:
                metadata[field] = doc[field]
        if doc.get("custom_fields"):
            raise HTTPException(422, "Document contains custom fields; mapping is required before copying")
        index = local._load_index(user.id)
        doc_id = str(uuid.uuid4())
        stored_name = f"{doc_id}{suffix}"
        mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        entry = {"id": doc_id, "title": doc.get("title") or Path(filename).stem,
                 "description": "", "filename": filename, "stored_name": stored_name,
                 "folder": "", "size": len(content), "mime_type": mime,
                 "uploaded_at": datetime.now(timezone.utc).isoformat(),
                 "paperless_metadata": metadata}
        for key, items in definitions.items():
            existing = index.setdefault("metadata_definitions", {}).setdefault(key, [])
            names = {item["name"].casefold() for item in existing}
            for item in items:
                if item["name"].casefold() not in names:
                    existing.append({"name": item["name"]})
                    names.add(item["name"].casefold())
        path = local._user_dir(user.id) / stored_name
        path.write_bytes(content)
        try:
            index["documents"].append(entry)
            local._save_index(user.id, index)
        except Exception:
            path.unlink(missing_ok=True)
            raise
        return entry
    except PaperlessError as exc:
        raise _error(exc)


@router.get("/tasks")
async def list_tasks(user: User = Depends(get_current_user)):
    try:
        return await _client(user).tasks()
    except PaperlessError as exc:
        raise _error(exc)



@router.get("/documents/{item_id}/preview")
async def preview_from_paperless(
    item_id: int,
    user: User = Depends(get_current_user),
):
    try:
        content = await _client(user).download(item_id, archived=True)
    except PaperlessError as exc:
        raise _error(exc)
    if not content.startswith(b"%PDF-"):
        raise HTTPException(415, "Archived PDF preview is not available")
    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="paperless-{item_id}.pdf"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        },
    )


@router.get("/documents/{item_id}/download")
async def download_from_paperless(
    item_id: int,
    archived: bool = False,
    user: User = Depends(get_current_user),
):
    try:
        content = await _client(user).download(item_id, archived=archived)
    except PaperlessError as exc:
        raise _error(exc)

    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="paperless-{item_id}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        },
    )


@router.get("/{resource}/{item_id}")
async def get_resource(
    resource: str,
    item_id: int,
    user: User = Depends(get_current_user),
):
    try:
        return await _client(user).get(resource, item_id)
    except ValueError:
        raise HTTPException(404, "Unknown Paperless resource")
    except PaperlessError as exc:
        raise _error(exc)


@router.delete("/{resource}/{item_id}", status_code=204)
async def delete_resource(
    resource: str,
    item_id: int,
    user: User = Depends(get_current_user),
):
    try:
        await _client(user).delete(resource, item_id)
    except ValueError:
        raise HTTPException(404, "Unknown Paperless resource")
    except PaperlessError as exc:
        raise _error(exc)


@router.get("/{resource}")
async def list_resource(resource: str, user: User = Depends(get_current_user),
                        page: int = Query(1, ge=1),
                        page_size: int = Query(25, ge=1, le=100),
                        search: str | None = Query(None, max_length=200)):
    try:
        params = {"page": page, "page_size": page_size}
        if search:
            params["search"] = search
        return await _client(user).list(resource, params=params)
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
