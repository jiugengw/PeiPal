"""Shared coordination: first decision wins, single ownership, ready and done."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.services.coordination import apply_action


ACTOR = {"actor_id": 3, "actor_name": "Anna Lim"}
OTHER = {"actor_id": 4, "actor_name": "David Lim"}


class CoordinationClient:
    """A fake Supabase client whose task updates honour the version guard."""

    def __init__(self, tasks=None, plan_status="coordinating"):
        self.tasks = tasks or {
            "approval": {"id": 1, "task_type": "approval", "status": "open",
                         "owner_family_member_id": None, "decided_by_family_member_id": None,
                         "version": 1, "reason": None},
            "registration": {"id": 2, "task_type": "registration", "status": "open",
                             "owner_family_member_id": None, "decided_by_family_member_id": None,
                             "version": 1, "reason": None},
            "transport": {"id": 3, "task_type": "transport", "status": "open",
                          "owner_family_member_id": None, "decided_by_family_member_id": None,
                          "version": 1, "reason": None},
        }
        self.plan_status = plan_status
        self.events = []

    def table(self, name):
        return _Query(self, name)


class _Query:
    def __init__(self, client, name):
        self.client = client
        self.name = name
        self.operation = "select"
        self.values = None
        self.filters = {}

    def select(self, *_args, **_kwargs):
        return self

    def insert(self, values, **_kwargs):
        self.operation, self.values = "insert", values
        return self

    def update(self, values, **_kwargs):
        self.operation, self.values = "update", values
        return self

    def eq(self, field, value):
        self.filters[field] = value
        return self

    def limit(self, *_args):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def execute(self):
        client = self.client
        if self.name == "plan_coordination_tasks":
            if self.operation == "update":
                task = next(
                    (t for t in client.tasks.values() if t["id"] == self.filters.get("id")), None
                )
                # The guard: only apply if nobody else moved first.
                if task is None or task["version"] != self.filters.get("version"):
                    return SimpleNamespace(data=[])
                task.update(self.values)
                return SimpleNamespace(data=[task])
            if "task_type" in self.filters:
                task = client.tasks.get(self.filters["task_type"])
                return SimpleNamespace(data=[task] if task else [])
            return SimpleNamespace(data=list(client.tasks.values()))
        if self.name == "plan_coordination_events":
            if self.operation == "insert":
                client.events.append(self.values)
            return SimpleNamespace(data=[{}])
        if self.name == "plans":
            if self.operation == "update":
                if self.filters.get("status") == "coordinating" and client.plan_status != "coordinating":
                    return SimpleNamespace(data=[])
                client.plan_status = self.values["status"]
                return SimpleNamespace(data=[{"id": 9, **self.values}])
            return SimpleNamespace(data=[{"status": client.plan_status}])
        return SimpleNamespace(data=[])


def act(client, task_type, action, version=1, actor=None, reason=None):
    return apply_action(
        client,
        plan_id=9,
        coordination_id=1,
        task_type=task_type,
        action=action,
        expected_version=version,
        reason=reason,
        **(actor or ACTOR),
    )


# --- Approval -----------------------------------------------------------------------


def test_the_first_approval_settles_the_plan():
    client = CoordinationClient()

    act(client, "approval", "approve")

    assert client.tasks["approval"]["status"] == "approved"
    assert client.tasks["approval"]["decided_by_family_member_id"] == 3


def test_the_first_rejection_ends_the_plan():
    client = CoordinationClient()

    result = act(client, "approval", "reject", reason="Too far to travel.")

    assert client.tasks["approval"]["status"] == "rejected"
    assert client.tasks["approval"]["reason"] == "Too far to travel."
    assert result["plan_status"] == "rejected"
    assert client.plan_status == "rejected"


def test_a_second_decision_is_refused_as_already_decided():
    client = CoordinationClient()
    act(client, "approval", "approve")

    with pytest.raises(HTTPException) as error:
        act(client, "approval", "reject", version=client.tasks["approval"]["version"], actor=OTHER)

    assert error.value.status_code == 409
    assert client.tasks["approval"]["status"] == "approved"


def test_two_simultaneous_decisions_leave_exactly_one_winner():
    """Both people loaded version 1; only one update can match it."""

    client = CoordinationClient()

    act(client, "approval", "approve", version=1)
    with pytest.raises(HTTPException) as error:
        act(client, "approval", "reject", version=1, actor=OTHER)

    assert error.value.status_code == 409
    assert client.tasks["approval"]["status"] == "approved"


def test_a_stale_version_is_refused_even_for_a_valid_action():
    client = CoordinationClient()
    act(client, "registration", "claim", version=1)

    with pytest.raises(HTTPException) as error:
        act(client, "registration", "claim", version=1, actor=OTHER)

    assert error.value.status_code == 409


def test_approval_cannot_be_claimed_like_a_chore():
    client = CoordinationClient()

    with pytest.raises(HTTPException) as error:
        act(client, "approval", "claim")

    assert error.value.status_code == 400


# --- Registration and transport ------------------------------------------------------


def test_claiming_records_the_owner():
    client = CoordinationClient()

    act(client, "transport", "claim")

    assert client.tasks["transport"]["status"] == "claimed"
    assert client.tasks["transport"]["owner_family_member_id"] == 3


def test_someone_else_cannot_quietly_claim_an_owned_task():
    client = CoordinationClient()
    act(client, "registration", "claim")

    with pytest.raises(HTTPException) as error:
        act(client, "registration", "claim",
            version=client.tasks["registration"]["version"], actor=OTHER)

    assert error.value.status_code == 409


def test_a_takeover_replaces_the_owner_and_is_recorded():
    client = CoordinationClient()
    act(client, "registration", "claim")

    act(client, "registration", "take_over",
        version=client.tasks["registration"]["version"], actor=OTHER)

    assert client.tasks["registration"]["owner_family_member_id"] == 4
    assert any(event["action"] == "took over" for event in client.events)


def test_only_the_owner_can_complete_or_step_back():
    client = CoordinationClient()
    act(client, "transport", "claim")

    for action in ["complete", "release"]:
        with pytest.raises(HTTPException) as error:
            act(client, "transport", action,
                version=client.tasks["transport"]["version"], actor=OTHER)
        assert error.value.status_code == 403


def test_releasing_returns_the_task_to_the_family():
    client = CoordinationClient()
    act(client, "transport", "claim")

    act(client, "transport", "release", version=client.tasks["transport"]["version"])

    assert client.tasks["transport"]["status"] == "open"
    assert client.tasks["transport"]["owner_family_member_id"] is None


def test_an_owned_task_cannot_be_marked_not_needed():
    client = CoordinationClient()
    act(client, "registration", "claim")

    with pytest.raises(HTTPException) as error:
        act(client, "registration", "not_needed",
            version=client.tasks["registration"]["version"], actor=OTHER)

    assert error.value.status_code == 409


# --- Reaching ready ------------------------------------------------------------------


def test_approval_alone_does_not_make_a_plan_ready():
    client = CoordinationClient()

    result = act(client, "approval", "approve")

    assert result["plan_status"] == "coordinating"


def test_a_plan_is_ready_once_approval_and_both_tasks_are_resolved():
    client = CoordinationClient()

    act(client, "approval", "approve")
    act(client, "registration", "not_needed")
    act(client, "transport", "claim")
    result = act(client, "transport", "complete",
                 version=client.tasks["transport"]["version"])

    assert result["plan_status"] == "ready"
    assert client.plan_status == "ready"


def test_resolved_tasks_without_approval_do_not_make_a_plan_ready():
    client = CoordinationClient()

    act(client, "registration", "not_needed")
    result = act(client, "transport", "not_needed")

    assert result["plan_status"] == "coordinating"


def test_a_rejection_overrides_resolved_tasks():
    client = CoordinationClient()
    act(client, "registration", "not_needed")
    act(client, "transport", "not_needed")

    result = act(client, "approval", "reject")

    assert result["plan_status"] == "rejected"


def test_an_unknown_task_is_not_found():
    client = CoordinationClient()

    with pytest.raises(HTTPException) as error:
        act(client, "catering", "claim")

    assert error.value.status_code == 404
