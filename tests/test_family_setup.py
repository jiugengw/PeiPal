"""Family creation, email verification, members, and invitations."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from src.api import routes
from src.api.models import (
    FamilyCreate,
    FamilyEmailVerification,
    FamilyMemberCreate,
    FamilyMemberRelationship,
    OlderAdultCreate,
)
from src.api.routes import create_family_member, verify_family_email
from src.services.family_email import digest, expires_in, generate_code, generate_token


USER = SimpleNamespace(id="user-1")


class TableQuery:
    """Records writes and replays a queued response per table."""

    def __init__(self, name, responses, writes):
        self.name = name
        self.responses = responses
        self.writes = writes

    def select(self, *_args, **_kwargs):
        return self

    def insert(self, values, **_kwargs):
        self.writes.append((self.name, "insert", values))
        return self

    def upsert(self, values, **_kwargs):
        self.writes.append((self.name, "upsert", values))
        return self

    def update(self, values, **_kwargs):
        self.writes.append((self.name, "update", values))
        return self

    def delete(self, **_kwargs):
        self.writes.append((self.name, "delete", None))
        return self

    def eq(self, *_args):
        return self

    def neq(self, *_args):
        return self

    def ilike(self, *_args):
        return self

    def in_(self, *_args):
        return self

    def is_(self, *_args):
        return self

    def limit(self, *_args):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def execute(self):
        queue = self.responses.get(self.name)
        data = queue.pop(0) if queue else []
        return SimpleNamespace(data=data)


class FakeClient:
    def __init__(self, responses=None):
        self.responses = {name: list(rows) for name, rows in (responses or {}).items()}
        self.writes = []

    def table(self, name):
        return TableQuery(name, self.responses, self.writes)


def written(client, table, operation):
    return [values for name, op, values in client.writes if name == table and op == operation]


# --- Verification codes and tokens -------------------------------------------------


def test_verification_code_is_six_digits():
    for _ in range(50):
        code = generate_code()
        assert len(code) == 6 and code.isdigit()


def test_codes_are_stored_only_as_a_digest():
    code = generate_code()

    assert digest(code) != code
    assert digest(code) == digest(code)
    assert len(digest(code)) == 64


def test_invitation_tokens_are_unique_and_unguessable():
    tokens = {generate_token() for _ in range(200)}

    assert len(tokens) == 200
    assert all(len(token) >= 32 for token in tokens)


def test_verification_payload_rejects_a_malformed_code():
    for bad in ["12345", "1234567", "abcdef", ""]:
        with pytest.raises(ValidationError):
            FamilyEmailVerification(code=bad)


# --- Email verification ------------------------------------------------------------


def test_verifying_with_the_right_code_marks_the_family_verified(monkeypatch):
    monkeypatch.setattr(routes, "require_family_account", lambda *_args: None)
    code = "123456"
    client = FakeClient({
        "family_email_verifications": [
            [{"id": 5, "code_hash": digest(code), "expires_at": expires_in(30)}],
            [{}],
        ],
        "families": [[{}]],
    })

    result = verify_family_email(1, FamilyEmailVerification(code=code), USER, client)

    assert result["verified"] is True
    assert written(client, "families", "update")[0]["owner_email_verified_at"]


def test_an_invalid_verification_code_is_rejected(monkeypatch):
    monkeypatch.setattr(routes, "require_family_account", lambda *_args: None)
    client = FakeClient({
        "family_email_verifications": [
            [{"id": 5, "code_hash": digest("123456"), "expires_at": expires_in(30)}],
        ],
    })

    with pytest.raises(HTTPException) as error:
        verify_family_email(1, FamilyEmailVerification(code="999999"), USER, client)

    assert error.value.status_code == 400
    assert not written(client, "families", "update")


def test_an_expired_verification_code_is_rejected(monkeypatch):
    monkeypatch.setattr(routes, "require_family_account", lambda *_args: None)
    code = "123456"
    client = FakeClient({
        "family_email_verifications": [
            [{"id": 5, "code_hash": digest(code), "expires_at": expires_in(-1)}],
        ],
    })

    with pytest.raises(HTTPException) as error:
        verify_family_email(1, FamilyEmailVerification(code=code), USER, client)

    assert error.value.status_code == 400
    assert not written(client, "families", "update")


def test_verifying_without_a_pending_code_is_rejected(monkeypatch):
    monkeypatch.setattr(routes, "require_family_account", lambda *_args: None)
    client = FakeClient({"family_email_verifications": [[]]})

    with pytest.raises(HTTPException) as error:
        verify_family_email(1, FamilyEmailVerification(code="123456"), USER, client)

    assert error.value.status_code == 400


# --- Family members and relationships ----------------------------------------------


def test_a_family_supports_several_older_adults():
    first = OlderAdultCreate(family_id=1, name="Mary Lim")
    second = OlderAdultCreate(family_id=1, name="Robert Lim")

    assert first.family_id == second.family_id == 1


def test_a_member_can_hold_a_different_relationship_to_each_older_adult():
    member = FamilyMemberCreate(
        family_id=1,
        name="Anna Lim",
        email="anna@example.com",
        relationships=[
            FamilyMemberRelationship(older_adult_id=1, relationship="Daughter"),
            FamilyMemberRelationship(older_adult_id=2, relationship="Sister"),
        ],
    )

    assert [item.relationship for item in member.relationships] == ["Daughter", "Sister"]


def test_a_family_member_needs_at_least_one_relationship():
    with pytest.raises(ValidationError):
        FamilyMemberCreate(
            family_id=1, name="Anna", email="anna@example.com", relationships=[]
        )


def test_a_family_member_needs_a_valid_email_address():
    with pytest.raises(ValidationError):
        FamilyMemberCreate(
            family_id=1,
            name="Anna",
            email="not-an-address",
            relationships=[FamilyMemberRelationship(older_adult_id=1, relationship="Daughter")],
        )


def test_adding_a_member_stores_each_relationship(monkeypatch):
    monkeypatch.setattr(routes, "require_family_account", lambda *_args: None)
    client = FakeClient({
        "older_adult_profiles": [[{"id": 1}, {"id": 2}]],
        "family_members": [
            [],  # no duplicate email
            [{"id": 7}],  # insert
            [{"id": 7, "family_id": 1, "name": "Anna Lim", "email": "anna@example.com",
              "created_at": "2030-01-01T00:00:00Z",
              "family_member_older_adults": [
                  {"older_adult_id": 1, "relationship": "Daughter"},
                  {"older_adult_id": 2, "relationship": "Sister"},
              ]}],
        ],
        "family_member_older_adults": [[], []],
    })

    result = create_family_member(
        FamilyMemberCreate(
            family_id=1,
            name="Anna Lim",
            email="Anna@Example.com",
            relationships=[
                FamilyMemberRelationship(older_adult_id=1, relationship="Daughter"),
                FamilyMemberRelationship(older_adult_id=2, relationship="Sister"),
            ],
        ),
        USER,
        client,
    )

    assert result["relationships"] == [
        {"older_adult_id": 1, "relationship": "Daughter"},
        {"older_adult_id": 2, "relationship": "Sister"},
    ]
    # The address is normalised so a duplicate cannot slip in by casing.
    assert written(client, "family_members", "insert")[0]["email"] == "anna@example.com"
    links = written(client, "family_member_older_adults", "insert")[0]
    assert {item["relationship"] for item in links} == {"Daughter", "Sister"}


def test_a_duplicate_family_member_email_is_refused(monkeypatch):
    monkeypatch.setattr(routes, "require_family_account", lambda *_args: None)
    client = FakeClient({
        "older_adult_profiles": [[{"id": 1}]],
        "family_members": [[{"id": 3}]],
    })

    with pytest.raises(HTTPException) as error:
        create_family_member(
            FamilyMemberCreate(
                family_id=1,
                name="Anna",
                email="anna@example.com",
                relationships=[FamilyMemberRelationship(older_adult_id=1, relationship="Daughter")],
            ),
            USER,
            client,
        )

    assert error.value.status_code == 409
    assert not written(client, "family_members", "insert")


def test_a_relationship_to_another_familys_older_adult_is_refused(monkeypatch):
    monkeypatch.setattr(routes, "require_family_account", lambda *_args: None)
    client = FakeClient({"older_adult_profiles": [[]]})

    with pytest.raises(HTTPException) as error:
        create_family_member(
            FamilyMemberCreate(
                family_id=1,
                name="Anna",
                email="anna@example.com",
                relationships=[FamilyMemberRelationship(older_adult_id=99, relationship="Daughter")],
            ),
            USER,
            client,
        )

    assert error.value.status_code == 400
    assert not written(client, "family_members", "insert")


def test_family_creation_accepts_an_owner_email():
    payload = FamilyCreate(name="Lim Family", owner_email="anna@example.com")

    assert payload.owner_email == "anna@example.com"
