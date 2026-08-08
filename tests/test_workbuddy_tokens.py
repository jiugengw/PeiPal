"""Personal access tokens for WorkBuddy/ChatGPT-style MCP clients."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.api.dependencies import require_user
from src.services.family_email import digest
from src.services.workbuddy_tokens import create_token, list_tokens, resolve_token, revoke_token


class FakeTokensClient:
    """A fake Supabase client backing a single workbuddy_access_tokens table."""

    def __init__(self):
        self.rows: dict[int, dict] = {}
        self._next_id = 1

    def table(self, name):
        assert name == "workbuddy_access_tokens"
        return _Query(self)


class _Query:
    def __init__(self, client):
        self.client = client
        self.operation = None
        self.values = None
        self.filters = {}
        self.order_desc = False
        self.columns = None

    def insert(self, values):
        self.operation, self.values = "insert", values
        return self

    def update(self, values):
        self.operation, self.values = "update", values
        return self

    def select(self, columns="*", **_kwargs):
        self.operation = self.operation or "select"
        self.columns = [c.strip() for c in columns.split(",")] if columns != "*" else None
        return self

    def eq(self, field, value):
        self.filters[field] = value
        return self

    def limit(self, *_args):
        return self

    def order(self, _field, desc=False):
        self.order_desc = desc
        return self

    def execute(self):
        client = self.client
        if self.operation == "insert":
            row_id = client._next_id
            client._next_id += 1
            row = {
                "id": row_id,
                "revoked_at": None,
                "created_at": "2026-01-01T00:00:00+00:00",
                **self.values,
            }
            client.rows[row_id] = row
            return SimpleNamespace(data=[row])
        if self.operation == "update":
            row = client.rows.get(self.filters.get("id"))
            if row is None:
                return SimpleNamespace(data=[])
            row.update(self.values)
            return SimpleNamespace(data=[row])
        rows = list(client.rows.values())
        for field, value in self.filters.items():
            rows = [r for r in rows if r.get(field) == value]
        rows.sort(key=lambda r: r["id"], reverse=self.order_desc)
        if self.columns is not None:
            rows = [{c: r[c] for c in self.columns} for r in rows]
        return SimpleNamespace(data=rows)


def test_create_token_stores_only_the_hash():
    client = FakeTokensClient()

    result = create_token(client, user_id="user-1", name="WorkBuddy")

    row = next(iter(client.rows.values()))
    assert row["token_hash"] == digest(result["token"])
    assert result["name"] == "WorkBuddy"


def test_list_tokens_never_returns_the_raw_value():
    client = FakeTokensClient()
    create_token(client, user_id="user-1", name="WorkBuddy")
    create_token(client, user_id="user-1", name="ChatGPT")
    create_token(client, user_id="user-2", name="Someone else's app")

    tokens = list_tokens(client, user_id="user-1")

    assert {t["name"] for t in tokens} == {"WorkBuddy", "ChatGPT"}
    assert all("token" not in t and "token_hash" not in t for t in tokens)


def test_resolve_token_returns_the_owning_user_id():
    client = FakeTokensClient()
    result = create_token(client, user_id="user-1", name="WorkBuddy")

    assert resolve_token(client, result["token"]) == "user-1"


def test_resolve_token_returns_none_for_unknown_token():
    client = FakeTokensClient()
    assert resolve_token(client, "made-up") is None


def test_revoke_token_stops_it_resolving():
    client = FakeTokensClient()
    result = create_token(client, user_id="user-1", name="WorkBuddy")

    revoke_token(client, user_id="user-1", token_id=result["id"])

    assert resolve_token(client, result["token"]) is None


def test_revoke_token_rejects_someone_elses_token():
    client = FakeTokensClient()
    result = create_token(client, user_id="user-1", name="WorkBuddy")

    with pytest.raises(HTTPException) as error:
        revoke_token(client, user_id="user-2", token_id=result["id"])
    assert error.value.status_code == 404


def test_require_user_resolves_a_personal_access_token_directly_to_a_user():
    row = {"user_id": "user-1", "revoked_at": None, "token_hash": digest("pat-abc")}
    client = FakeAuthClient(rows=[row])

    user = require_user(authorization="Bearer pat-abc", client=client)

    assert user.id == "user-1"
    assert client.get_user_calls == []  # never falls through to a real Supabase call


def test_require_user_falls_back_to_a_normal_supabase_jwt():
    fake_user = SimpleNamespace(id="user-2")
    client = FakeAuthClient(rows=[], user=fake_user)

    user = require_user(authorization="Bearer some-normal-jwt", client=client)

    assert user is fake_user
    assert client.get_user_calls == ["some-normal-jwt"]


class FakeAuthClient:
    """A fake Supabase client exposing both .table() and .auth.get_user()."""

    def __init__(self, rows=None, user=None):
        self._rows = rows or []
        self._user = user
        self.get_user_calls = []

    def table(self, name):
        assert name == "workbuddy_access_tokens"
        return _SelectOnly(self._rows)

    @property
    def auth(self):
        return self

    def get_user(self, token):
        self.get_user_calls.append(token)
        if self._user is None:
            raise Exception("The Supabase session is invalid or expired.")
        return SimpleNamespace(user=self._user)


class _SelectOnly:
    def __init__(self, rows):
        self.rows = rows
        self.filters = {}

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, field, value):
        self.filters[field] = value
        return self

    def limit(self, *_args):
        return self

    def execute(self):
        rows = [r for r in self.rows if all(r.get(k) == v for k, v in self.filters.items())]
        return SimpleNamespace(data=rows)
