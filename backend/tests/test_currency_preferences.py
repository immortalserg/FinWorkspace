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


def test_currency_preferences_are_isolated_between_users(client, db, seed_user):
    from app.models import User
    from app.database import get_db
    from app.utils.security import get_current_user_authenticated
    import main

    other = User(
        email="other-currency@example.com",
        hashed_password="x",
        full_name="Other user",
        is_active=True,
    )
    db.add(other)
    db.commit()
    db.refresh(other)

    assert client.put(
        "/api/auth/me/currency-preferences",
        json={"mode": "converted", "base": "USD"},
    ).status_code == 200

    main.app.dependency_overrides[get_current_user_authenticated] = lambda: other
    assert client.get("/api/auth/me/currency-preferences").json() == {
        "mode": "both", "base": "EUR"
    }
    assert client.put(
        "/api/auth/me/currency-preferences",
        json={"mode": "separate", "base": "UAH"},
    ).status_code == 200
    assert client.get("/api/auth/me/currency-preferences").json() == {
        "mode": "separate", "base": "UAH"
    }

    main.app.dependency_overrides[get_current_user_authenticated] = lambda: seed_user
    assert client.get("/api/auth/me/currency-preferences").json() == {
        "mode": "converted", "base": "USD"
    }
