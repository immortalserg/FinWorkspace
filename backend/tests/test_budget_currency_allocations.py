"""Budgets count only matching currency and allocated category shares."""
from datetime import date

from app.models import Account, Budget, BudgetCategory, Category, Transaction, TransactionAllocation
from app.routers.budgets import _budget_spending


def test_budget_spending_splits_and_currencies(db, seed_user):
    eur = Account(user_id=seed_user.id, name="EUR", type="checking", currency="EUR")
    usd = Account(user_id=seed_user.id, name="USD", type="checking", currency="USD")
    food = Category(user_id=seed_user.id, name="Food", type="expense")
    travel = Category(user_id=seed_user.id, name="Travel", type="expense")
    db.add_all([eur, usd, food, travel])
    db.flush()

    transaction = Transaction(
        user_id=seed_user.id, account_id=eur.id, category_id=food.id,
        amount=100, type="expense", description="Split purchase", date=date(2026, 11, 1),
    )
    other_currency = Transaction(
        user_id=seed_user.id, account_id=usd.id, category_id=food.id,
        amount=500, type="expense", description="USD purchase", date=date(2026, 11, 1),
    )
    db.add_all([transaction, other_currency])
    db.flush()
    db.add(TransactionAllocation(transaction_id=transaction.id, category_id=travel.id, amount=30))
    budget = Budget(user_id=seed_user.id, name="Food EUR", amount=200, currency="EUR", period="monthly")
    db.add(budget)
    db.flush()
    db.add(BudgetCategory(budget_id=budget.id, category_id=food.id))
    db.commit()

    assert _budget_spending(db, budget, date(2026, 11, 1), date(2026, 11, 30), [food.id]) == 70
    assert _budget_spending(db, budget, date(2026, 11, 1), date(2026, 11, 30), [travel.id]) == 30
    assert _budget_spending(db, budget, date(2026, 11, 1), date(2026, 11, 30), None) == 100


def test_budget_api_preserves_currency(client, db, seed_user):
    response = client.post("/api/budgets/", json={
        "name": "Dollar budget", "amount": 250, "currency": "USD",
        "period": "monthly", "category_ids": [],
    })
    assert response.status_code == 201, response.text
    budget_id = response.json()["id"]
    assert response.json()["currency"] == "USD"

    detail = client.get(f"/api/budgets/{budget_id}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["currency"] == "USD"

    updated = client.put(f"/api/budgets/{budget_id}", json={"currency": "EUR"})
    assert updated.status_code == 200, updated.text
    assert updated.json()["currency"] == "EUR"


def test_budget_transactions_include_only_matching_allocated_shares(client, db, seed_user):
    eur = Account(user_id=seed_user.id, name="EUR", type="checking", currency="EUR")
    usd = Account(user_id=seed_user.id, name="USD", type="checking", currency="USD")
    food = Category(user_id=seed_user.id, name="Food", type="expense")
    travel = Category(user_id=seed_user.id, name="Travel", type="expense")
    db.add_all([eur, usd, food, travel])
    db.flush()
    split = Transaction(
        user_id=seed_user.id, account_id=eur.id, category_id=food.id,
        amount=100, type="expense", description="EUR split", date=date(2026, 11, 1),
    )
    foreign = Transaction(
        user_id=seed_user.id, account_id=usd.id, category_id=travel.id,
        amount=200, type="expense", description="USD travel", date=date(2026, 11, 1),
    )
    db.add_all([split, foreign])
    db.flush()
    db.add(TransactionAllocation(transaction_id=split.id, category_id=travel.id, amount=30))
    db.commit()

    response = client.post("/api/budgets/", json={
        "name": "Travel", "amount": 100, "currency": "EUR",
        "period": "custom", "start_date": "2026-11-01T00:00:00",
        "end_date": "2026-11-30T00:00:00", "category_ids": [travel.id],
    })
    assert response.status_code == 201, response.text
    budget_id = response.json()["id"]
    transactions = client.get(f"/api/budgets/{budget_id}/transactions")
    assert transactions.status_code == 200, transactions.text
    assert transactions.json()["total"] == 1
    assert transactions.json()["items"][0]["id"] == split.id
    assert transactions.json()["items"][0]["budget_amount"] == 30


def test_annual_budget_summary_uses_allocated_shares(client, db, seed_user):
    eur = Account(user_id=seed_user.id, name="EUR", type="checking", currency="EUR")
    usd = Account(user_id=seed_user.id, name="USD", type="checking", currency="USD")
    food = Category(user_id=seed_user.id, name="Food", type="expense")
    travel = Category(user_id=seed_user.id, name="Travel", type="expense")
    db.add_all([eur, usd, food, travel])
    db.flush()
    eur_tx = Transaction(
        user_id=seed_user.id, account_id=eur.id, category_id=food.id,
        amount=100, type="expense", description="EUR split", date=date(2026, 11, 1),
    )
    usd_tx = Transaction(
        user_id=seed_user.id, account_id=usd.id, category_id=travel.id,
        amount=200, type="expense", description="USD excluded", date=date(2026, 11, 1),
    )
    db.add_all([eur_tx, usd_tx])
    db.flush()
    db.add(TransactionAllocation(transaction_id=eur_tx.id, category_id=travel.id, amount=30))
    db.commit()
    created = client.post("/api/budgets/", json={
        "name": "Travel EUR", "amount": 100, "currency": "EUR",
        "period": "monthly", "category_ids": [travel.id],
    })
    assert created.status_code == 201, created.text
    response = client.get(f"/api/budgets/{created.json()['id']}/summary?year=2026")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["budget"]["currency"] == "EUR"
    assert data["year_total"]["spent"] == 30
    november = next(p for p in data["periods"] if p["period_start"].startswith("2026-11"))
    assert november["spent"] == 30
    assert len(november["transactions"]) == 1
    assert november["transactions"][0]["id"] == eur_tx.id
    assert november["transactions"][0]["budget_amount"] == 30


def test_budget_progress_matches_transaction_shares_and_annual_summary(client, db, seed_user):
    """One split purchase must reconcile across the budget endpoints."""
    eur = Account(user_id=seed_user.id, name="EUR", type="checking", currency="EUR")
    usd = Account(user_id=seed_user.id, name="USD", type="checking", currency="USD")
    food = Category(user_id=seed_user.id, name="Food", type="expense")
    travel = Category(user_id=seed_user.id, name="Travel", type="expense")
    db.add_all([eur, usd, food, travel])
    db.flush()

    eur_tx = Transaction(
        user_id=seed_user.id, account_id=eur.id, category_id=food.id,
        amount=100, type="expense", description="Shared purchase", date=date(2026, 11, 1),
    )
    usd_tx = Transaction(
        user_id=seed_user.id, account_id=usd.id, category_id=travel.id,
        amount=500, type="expense", description="Foreign purchase", date=date(2026, 11, 1),
    )
    db.add_all([eur_tx, usd_tx])
    db.flush()
    db.add(TransactionAllocation(transaction_id=eur_tx.id, category_id=travel.id, amount=30))
    db.commit()

    created = client.post("/api/budgets/", json={
        "name": "Combined EUR", "amount": 200, "currency": "EUR",
        "period": "custom", "start_date": "2026-11-01T00:00:00",
        "end_date": "2026-11-30T00:00:00",
        "category_ids": [food.id, travel.id],
    })
    assert created.status_code == 201, created.text
    budget = created.json()
    assert budget["currency"] == "EUR"
    assert budget["spent"] == 100

    tx_response = client.get(f"/api/budgets/{budget['id']}/transactions")
    assert tx_response.status_code == 200, tx_response.text
    tx_data = tx_response.json()
    assert tx_data["total"] == 1
    assert tx_data["items"][0]["id"] == eur_tx.id
    assert tx_data["items"][0]["budget_amount"] == 100

    summary_response = client.get(f"/api/budgets/{budget['id']}/summary?year=2026")
    assert summary_response.status_code == 200, summary_response.text
    summary = summary_response.json()
    assert summary["budget"]["currency"] == "EUR"
    assert summary["year_total"]["spent"] == budget["spent"]
    assert sum(item["budget_amount"] for period in summary["periods"]
               for item in period["transactions"]) == budget["spent"]
