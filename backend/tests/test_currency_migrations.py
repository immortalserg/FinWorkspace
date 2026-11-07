"""Verify currency migrations preserve existing financial records on SQLite."""

import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text


VERSIONS = Path(__file__).resolve().parent.parent / "alembic" / "versions"


def _load_revision(filename):
    spec = importlib.util.spec_from_file_location(filename.removesuffix(".py"), VERSIONS / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_currency_migrations_preserve_existing_users_and_budgets():
    """Existing budget amounts, relationships and user records survive 029/030."""
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(255) NOT NULL)"
        ))
        connection.execute(text(
            "CREATE TABLE budgets (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, "
            "name VARCHAR(100) NOT NULL, amount FLOAT NOT NULL)"
        ))
        connection.execute(text("INSERT INTO users (id, email) VALUES (1, 'existing@example.com')"))
        connection.execute(text(
            "INSERT INTO budgets (id, user_id, name, amount) "
            "VALUES (7, 1, 'Existing budget', 123.45)"
        ))

        context = MigrationContext.configure(connection)
        with Operations.context(context):
            _load_revision("029_user_currency_preferences.py").upgrade()
            _load_revision("030_budget_currency.py").upgrade()

        user = connection.execute(text(
            "SELECT id, email, currency_display_mode, currency_base FROM users WHERE id = 1"
        )).one()
        budget = connection.execute(text(
            "SELECT id, user_id, name, amount, currency FROM budgets WHERE id = 7"
        )).one()

        assert tuple(user) == (1, "existing@example.com", "both", "EUR")
        assert tuple(budget) == (7, 1, "Existing budget", 123.45, "EUR")

        # Database defaults must also apply to records inserted outside the ORM.
        connection.execute(text(
            "INSERT INTO budgets (id, user_id, name, amount) "
            "VALUES (8, 1, 'New budget', 50)"
        ))
        assert connection.execute(text(
            "SELECT currency FROM budgets WHERE id = 8"
        )).scalar_one() == "EUR"
