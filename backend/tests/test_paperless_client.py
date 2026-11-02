"""Contract tests for the Paperless client using a mock HTTP transport."""
import asyncio

import httpx
import pytest

from app.services.paperless_client import PaperlessClient, PaperlessError


def test_upload_with_document_metadata():
    async def handler(request):
        assert request.headers["authorization"] == "Token example-token"
        body = request.content.decode("utf-8")
        for field in ("invoice.pdf", "document_type", "correspondent", "tags", "custom_fields"):
            assert field in body
        return httpx.Response(200, json="task-123")

    client = PaperlessClient(
        "https://paperless.example", "example-token",
        transport=httpx.MockTransport(handler),
    )
    result = asyncio.run(client.upload(
        "invoice.pdf", b"%PDF-1.4",
        metadata={
            "title": "Invoice", "document_type": 2, "correspondent": 3,
            "tags": [4, 5], "custom_fields": [{"field": 1, "value": "EUR"}],
        },
    ))
    assert result == "task-123"


def test_tag_crud():
    calls = []

    async def handler(request):
        calls.append((request.method, request.url.path))
        if request.method == "DELETE":
            return httpx.Response(204)
        return httpx.Response(200, json={"id": 7})

    client = PaperlessClient(
        "https://paperless.example", "example-token",
        transport=httpx.MockTransport(handler),
    )

    async def run():
        await client.list("tags")
        await client.create("tags", {"name": "Tax"})
        await client.update("tags", 7, {"name": "Taxes"})
        await client.delete("tags", 7)

    asyncio.run(run())
    assert calls == [
        ("GET", "/api/tags/"), ("POST", "/api/tags/"),
        ("PATCH", "/api/tags/7/"), ("DELETE", "/api/tags/7/"),
    ]


def test_redirect_is_rejected():
    client = PaperlessClient(
        "https://paperless.example", "example-token",
        transport=httpx.MockTransport(
            lambda _: httpx.Response(302, headers={"Location": "https://other.example/"})
        ),
    )
    with pytest.raises(PaperlessError):
        asyncio.run(client.list("documents"))


def test_invalid_urls():
    for url in (
        "file:///etc/passwd", "http://user:pass@example.com",
        "https://example.com/api", "https://example.com?token=secret",
    ):
        with pytest.raises(ValueError):
            PaperlessClient(url, "example-token")
