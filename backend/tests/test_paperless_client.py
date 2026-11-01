"""Tests for the Paperless API client."""
import httpx
import pytest
from app.services.paperless_client import PaperlessClient, PaperlessError


@pytest.mark.asyncio
async def test_upload_metadata():
    async def handler(request):
        body = request.content.decode()
        assert "invoice.pdf" in body
        assert "document_type" in body
        assert "tags" in body
        return httpx.Response(200, json="task-id")

    client = PaperlessClient(
        "https://paperless.example", "example-token",
        transport=httpx.MockTransport(handler),
    )
    result = await client.upload(
        "invoice.pdf", b"pdf data",
        metadata={"document_type": 2, "tags": [3, 4]},
    )
    assert result == "task-id"


@pytest.mark.asyncio
async def test_disallow_redirect():
    client = PaperlessClient(
        "https://paperless.example", "example-token",
        transport=httpx.MockTransport(
            lambda request: httpx.Response(302, headers={"Location": "https://other.example"})
        ),
    )
    with pytest.raises(PaperlessError):
        await client.list("documents")
