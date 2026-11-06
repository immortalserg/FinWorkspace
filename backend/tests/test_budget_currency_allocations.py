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
