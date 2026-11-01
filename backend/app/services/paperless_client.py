"""Async Paperless-ngx REST client.

The server URL and token must come from trusted backend configuration, never
directly from an untrusted request. HTTP redirects are intentionally disabled.
"""
from __future__ import annotations

from typing import Any
from urllib.parse import urlsplit

import httpx


class PaperlessError(Exception):
    """Sanitized upstream error; never includes credentials or response bodies."""

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        super().__init__(message)


class PaperlessClient:
    RESOURCES = frozenset({
        "documents", "tags", "document_types", "correspondents",
        "storage_paths", "custom_fields",
    })

    def __init__(self, base_url: str, token: str, *, transport: httpx.AsyncBaseTransport | None = None):
        parsed = urlsplit(base_url)
        if (parsed.scheme not in ("http", "https") or not parsed.hostname
                or parsed.username or parsed.password or parsed.query
                or parsed.fragment or parsed.path not in ("", "/")):
            raise ValueError("Paperless URL must be an HTTP(S) origin without credentials or path")
        if not token or not token.strip():
            raise ValueError("Paperless API token is required")
        self.base_url = base_url.rstrip("/")
        self._token = token
        self._transport = transport

    async def _request(self, method: str, path: str, *, params: dict | None = None,
                       json: Any = None, files: Any = None, data: Any = None) -> Any:
        try:
            async with httpx.AsyncClient(
                base_url=self.base_url,
                headers={"Authorization": f"Token {self._token}"},
                timeout=httpx.Timeout(30.0, connect=5.0),
                follow_redirects=False,
                transport=self._transport,
            ) as client:
                response = await client.request(
                    method, path, params=params, json=json, files=files, data=data
                )
        except httpx.RequestError as exc:
            raise PaperlessError(502, "Paperless server unavailable") from exc
        if response.status_code >= 400 or response.is_redirect:
            code = response.status_code
            raise PaperlessError(code if 400 <= code < 500 else 502,
                                 f"Paperless request failed (HTTP {code})")
        if not response.content:
            return None
        try:
            return response.json()
        except ValueError as exc:
            raise PaperlessError(502, "Invalid Paperless response") from exc

    @classmethod
    def _resource(cls, resource: str) -> str:
        if resource not in cls.RESOURCES:
            raise ValueError("Unsupported Paperless resource")
        return f"/api/{resource}/"

    async def list(self, resource: str, *, params: dict | None = None) -> Any:
        return await self._request("GET", self._resource(resource), params=params)

    async def get(self, resource: str, item_id: int) -> Any:
        return await self._request("GET", f"{self._resource(resource)}{int(item_id)}/")

    async def create(self, resource: str, payload: dict) -> Any:
        return await self._request("POST", self._resource(resource), json=payload)

    async def update(self, resource: str, item_id: int, payload: dict) -> Any:
        return await self._request("PATCH", f"{self._resource(resource)}{int(item_id)}/", json=payload)

    async def delete(self, resource: str, item_id: int) -> None:
        await self._request("DELETE", f"{self._resource(resource)}{int(item_id)}/")

    async def upload(self, filename: str, content: bytes, *, content_type: str = "application/pdf",
                     metadata: dict | None = None) -> Any:
        """Submit a document and metadata; response is an async task ID."""
        # httpx multipart encoder expects a mapping; a list of (key, value)
        # tuples raises AttributeError during request construction (HTTP 500).
        # Sequence values are expanded to repeated multipart fields by httpx.
        data: dict[str, str | list[str]] = {}
        for key, value in (metadata or {}).items():
            if value is None:
                continue
            if key == "tags":
                data[key] = [str(tag) for tag in value]
            elif key == "custom_fields":
                import json
                data[key] = json.dumps(value)
            else:
                data[key] = str(value)
        return await self._request(
            "POST", "/api/documents/post_document/",
            files={"document": (filename, content, content_type)}, data=data,
        )

    async def download(self, item_id: int, *, archived: bool = False) -> bytes:
        """Download document binary without returning a remote URL to the browser."""
        path = f"/api/documents/{int(item_id)}/download/"
        params = {"original": "false"} if archived else {"original": "true"}
        try:
            async with httpx.AsyncClient(
                base_url=self.base_url,
                headers={"Authorization": f"Token {self._token}"},
                timeout=httpx.Timeout(60.0, connect=5.0),
                follow_redirects=False,
                transport=self._transport,
            ) as client:
                response = await client.get(path, params=params)
        except httpx.RequestError as exc:
            raise PaperlessError(502, "Paperless server unavailable") from exc
        if response.status_code >= 400 or response.is_redirect:
            code = response.status_code
            raise PaperlessError(code if 400 <= code < 500 else 502,
                                 f"Paperless download failed (HTTP {code})")
        return response.content

    async def tasks(self, *, params: dict | None = None) -> Any:
        return await self._request("GET", "/api/tasks/", params=params)
