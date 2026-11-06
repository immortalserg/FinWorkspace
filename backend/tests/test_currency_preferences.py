"""User-specific currency preferences survive API requests and remain isolated."""


def test_currency_preferences_default_and_update(client):
    response = client.get("/api/auth/me/currency-preferences")
    assert response.status_code == 200
    assert response.json() == {"mode": "both", "base": "EUR"}

    response = client.put(
        "/api/auth/me/currency-preferences",
        json={"mode": "separate", "base": "RUB"},
    )
    assert response.status_code == 200
    assert response.json() == {"mode": "separate", "base": "RUB"}
    assert client.get("/api/auth/me/currency-preferences").json() == {
        "mode": "separate", "base": "RUB"
    }


def test_currency_preferences_reject_invalid_values(client):
    for payload in (
        {"mode": "invalid", "base": "EUR"},
        {"mode": "both", "base": "EURO"},
        {"mode": "both", "base": "usd"},
    ):
        response = client.put("/api/auth/me/currency-preferences", json=payload)
        assert response.status_code == 422
