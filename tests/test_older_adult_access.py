from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.api import routes
from src.api.dependencies import require_family_read_access


USER = SimpleNamespace(id="older-user")


class Query:
    def __init__(self, name, tables):
        self.name = name
        self.tables = tables
        self.filters = []

    def select(self, *_args, **_kwargs): return self
    def eq(self, field, value): self.filters.append((field, value)); return self
    def in_(self, *_args, **_kwargs): return self
    def limit(self, *_args, **_kwargs): return self
    def order(self, *_args, **_kwargs): return self
    def upsert(self, values, **_kwargs):
        self.tables.setdefault("writes", []).append((self.name, values))
        return self

    def execute(self):
        rows = list(self.tables.get(self.name, []))
        for field, value in self.filters:
            rows = [row for row in rows if str(row.get(field)) == str(value)]
        return SimpleNamespace(data=rows)


class Client:
    def __init__(self, tables): self.tables = tables
    def table(self, name): return Query(name, self.tables)


def profile():
    return {"id": 12, "family_id": 12, "name": "Mary", "preferred_name": "Mary", "user_id": USER.id}


def test_linked_older_adult_membership_is_repaired():
    client = Client({"older_adult_profiles": [profile()]})
    result = require_family_read_access(client, 12, USER)
    assert result["id"] == 12
    assert client.tables["writes"][0][1]["role"] == "older_adult"


def test_older_adult_cannot_read_another_family():
    with pytest.raises(HTTPException) as error:
        require_family_read_access(Client({"older_adult_profiles": [profile()]}), 99, USER)
    assert error.value.status_code == 403


def test_family_members_are_scoped_and_redacted():
    client = Client({
        "older_adult_profiles": [profile()],
        "family_members": [{
            "id": 1, "family_id": 12, "name": "Anna", "email": "anna@example.com",
            "created_at": "2030-01-01T00:00:00Z",
            "family_member_older_adults": [{"older_adult_id": 12, "relationship": "Daughter"}],
        }],
    })
    result = routes.list_family_members(12, USER, client)
    assert result["family_members"][0]["email"] is None
    assert result["family_members"][0]["relationships"] == [
        {"older_adult_id": 12, "relationship": "Daughter"}
    ]


def test_plans_are_scoped_to_the_older_adult():
    client = Client({
        "older_adult_profiles": [profile()],
        "plans": [
            {"id": 1, "family_id": 12, "older_adult_id": 12},
            {"id": 2, "family_id": 12, "older_adult_id": 99},
        ],
    })
    result = routes.list_plans(12, None, USER, client)
    assert [plan["id"] for plan in result["plans"]] == [1]
