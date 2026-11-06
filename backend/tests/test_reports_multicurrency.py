"""Regression coverage for currency-safe dashboard report endpoints."""
from datetime import date, timedelta

from app.models import TransactionAllocation
from tests.factories import make_account, make_category, make_transaction


def test_cashflow_keeps_eur_usd_rub_separate(client, db, seed_user):
    accounts = {}
    for currency in ("EUR", "USD", "RUB"):
        account = make_account(db, seed_user, name=currency)
        account.currency = currency
        accounts[currency] = account
    db.commit()
    make_transaction(db, seed_user, accounts["EUR"], amount=100, type="income")
    make_transaction(db, seed_user, accounts["EUR"], amount=30, type="expense")
    make_transaction(db, seed_user, accounts["USD"], amount=200, type="income")
    make_transaction(db, seed_user, accounts["USD"], amount=40, type="expense")
    make_transaction(db, seed_user, accounts["RUB"], amount=10000, type="expense")

    response = client.get("/api/reports/cashflow-by-currency")
    assert response.status_code == 200
    assert response.json()["currencies"] == {
        "EUR": {"income": 100.0, "expenses": 30.0},
        "USD": {"income": 200.0, "expenses": 40.0},
        "RUB": {"income": 0.0, "expenses": 10000.0},
    }


def test_spending_keeps_allocations_in_their_original_currency(client, db, seed_user):
    food = make_category(db, seed_user, name="Food")
    travel = make_category(db, seed_user, name="Travel")
    eur = make_account(db, seed_user, name="Euro")
    usd = make_account(db, seed_user, name="Dollar")
    eur.currency = "EUR"
    usd.currency = "USD"
    db.commit()

    eur_tx = make_transaction(db, seed_user, eur, food, amount=100)
    db.add(TransactionAllocation(transaction_id=eur_tx.id, category_id=travel.id, amount=30))
    make_transaction(db, seed_user, usd, food, amount=50)
    db.commit()

    response = client.get("/api/reports/spending-by-currency")
    assert response.status_code == 200
    body = response.json()
    assert body["currencies"]["EUR"] == {str(food.id): 70.0, str(travel.id): 30.0}
    assert body["currencies"]["USD"] == {str(food.id): 50.0}
    assert body["categories"][str(food.id)] == "Food"


def test_currency_report_date_and_account_filters(client, db, seed_user):
    food = make_category(db, seed_user, name="Food")
    eur = make_account(db, seed_user, name="Euro")
    usd = make_account(db, seed_user, name="Dollar")
    eur.currency = "EUR"
    usd.currency = "USD"
    db.commit()
    make_transaction(db, seed_user, eur, food, amount=12, tx_date=date.today())
    make_transaction(db, seed_user, usd, food, amount=99, tx_date=date.today())
    make_transaction(db, seed_user, eur, food, amount=1000, tx_date=date.today() - timedelta(days=60))

    params = {"start_date": date.today().isoformat(), "end_date": date.today().isoformat(),
              "account_ids": str(eur.id)}
    cashflow = client.get("/api/reports/cashflow-by-currency", params=params)
    spending = client.get("/api/reports/spending-by-currency", params=params)
    assert cashflow.status_code == spending.status_code == 200
    assert cashflow.json()["currencies"] == {"EUR": {"income": 0.0, "expenses": 12.0}}
    assert spending.json()["currencies"] == {"EUR": {str(food.id): 12.0}}
