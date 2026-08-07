"""First-decision-wins approval and the decision emails that follow it."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from src.api import routes
from src.api.models import PlanDecisionRequest, PlanUpdate
from src.api.routes import decide_family_plan, update_plan
from src.services.family_email import digest, expires_in
from src.services.plan_decisions import decision_message, delivery_summary


USER = SimpleNamespace(id="user-1")
TOKEN = "a-family-decision-token"

ACTIVITY = {
    "name": "Chair Yoga",
    "location": "Tiong Bahru CC",
    "start_at": "2030-06-01T10:00:00Z",
    "info_link": "https://example.com/yoga",
}


class DecisionClient:
    """A fake Supabase client with a single-winner plan update.

    `plans.update(...).eq("status", "awaiting_approval")` only matches while the
    plan is still undecided, which is what makes the first decision win.
    """

    def __init__(self, *, request_status="pending", expires_at=None, plan_status="awaiting_approval"):
        self.request_status = request_status
        self.expires_at = expires_at or expires_in(60)
        self.plan_status = plan_status
        self.sent = []
        self.decision_writes = []

    def table(self, name):
        return _Query(self, name)


class _Query:
    def __init__(self, client, name):
        self.client = client
        self.name = name
        self.operation = "select"
        self.values = None
        self.status_filter = None

    def select(self, *_args, **_kwargs):
        return self

    def insert(self, values, **_kwargs):
        self.operation, self.values = "insert", values
        return self

    def update(self, values, **_kwargs):
        self.operation, self.values = "update", values
        return self

    def eq(self, field, value):
        if field == "status":
            self.status_filter = value
        return self

    def limit(self, *_args):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def execute(self):
        client = self.client
        if self.name == "plan_approval_requests":
            if self.operation == "update":
                return SimpleNamespace(data=[{}])
            return SimpleNamespace(data=[{
                "id": 4,
                "plan_id": 9,
                "family_member_id": 3,
                "status": client.request_status,
                "expires_at": client.expires_at,
            }])
        if self.name == "plans":
            if self.operation == "update":
                # The guarded update matches only an undecided plan.
                if self.status_filter == "awaiting_approval" and client.plan_status != "awaiting_approval":
                    return SimpleNamespace(data=[])
                client.plan_status = self.values["status"]
                client.decision_writes.append(self.values)
                return SimpleNamespace(data=[{"id": 9, **self.values}])
            return SimpleNamespace(data=[{"older_adult_id": 2, "activity_id": 27, "status": client.plan_status}])
        if self.name == "family_members":
            return SimpleNamespace(data=[
                {"id": 3, "name": "Anna Lim", "email": "anna@example.com", "family_id": 1},
                {"id": 4, "name": "David Lim", "email": "david@example.com", "family_id": 1},
            ])
        if self.name == "older_adult_profiles":
            return SimpleNamespace(data=[{"name": "Mary Lim", "preferred_name": "Mary", "email": "mary@example.com"}])
        if self.name == "activities":
            return SimpleNamespace(data=[ACTIVITY])
        if self.name == "plan_decision_notifications":
            if self.operation == "insert":
                return SimpleNamespace(data=[{"id": len(client.decision_writes) + 100}])
            return SimpleNamespace(data=[])
        return SimpleNamespace(data=[])


def record_sends(monkeypatch, client, failing=()):
    def send(*, recipient_email, subject, body, idempotency_key):
        if recipient_email in failing:
            raise RuntimeError("provider failed")
        client.sent.append(recipient_email)
        return f"provider-{len(client.sent)}"

    monkeypatch.setattr("src.services.plan_decisions.send_plan_email", send)


# --- Deciding ----------------------------------------------------------------------


def test_a_decision_must_be_approved_or_rejected():
    with pytest.raises(ValidationError):
        PlanDecisionRequest(decision="maybe")


def test_the_first_approval_decides_the_plan(monkeypatch):
    client = DecisionClient()
    record_sends(monkeypatch, client)

    result = decide_family_plan(TOKEN, PlanDecisionRequest(decision="approved"), client)

    assert result["status"] == "approved"
    assert result["decided_by"] == "Anna Lim"
    assert client.decision_writes[0]["decision_by_family_member_id"] == 3
    assert client.decision_writes[0]["decided_at"]


def test_the_first_rejection_decides_the_plan(monkeypatch):
    client = DecisionClient()
    record_sends(monkeypatch, client)

    result = decide_family_plan(
        TOKEN, PlanDecisionRequest(decision="rejected", reason="Too far to travel."), client
    )

    assert result["status"] == "rejected"
    assert client.decision_writes[0]["decision_reason"] == "Too far to travel."


def test_a_second_decision_is_refused_as_already_decided(monkeypatch):
    client = DecisionClient()
    record_sends(monkeypatch, client)
    decide_family_plan(TOKEN, PlanDecisionRequest(decision="approved"), client)

    # A different family member's link, still pending, but the plan is decided.
    client.request_status = "pending"
    with pytest.raises(HTTPException) as error:
        decide_family_plan(TOKEN, PlanDecisionRequest(decision="rejected"), client)

    assert error.value.status_code == 409
    assert len(client.decision_writes) == 1


def test_two_simultaneous_decisions_produce_exactly_one_winner(monkeypatch):
    """Both requests pass the pending check; only the guarded update can win."""

    client = DecisionClient()
    record_sends(monkeypatch, client)

    first = decide_family_plan(TOKEN, PlanDecisionRequest(decision="approved"), client)
    with pytest.raises(HTTPException) as error:
        decide_family_plan(TOKEN, PlanDecisionRequest(decision="rejected"), client)

    assert first["status"] == "approved"
    assert error.value.status_code == 409
    assert client.plan_status == "approved"


def test_a_used_link_cannot_decide_again(monkeypatch):
    client = DecisionClient(request_status="used")
    record_sends(monkeypatch, client)

    with pytest.raises(HTTPException) as error:
        decide_family_plan(TOKEN, PlanDecisionRequest(decision="approved"), client)

    assert error.value.status_code == 409
    assert not client.decision_writes


def test_an_expired_link_cannot_decide(monkeypatch):
    client = DecisionClient(expires_at=expires_in(-1))
    record_sends(monkeypatch, client)

    with pytest.raises(HTTPException) as error:
        decide_family_plan(TOKEN, PlanDecisionRequest(decision="approved"), client)

    assert error.value.status_code == 410
    assert not client.decision_writes


def test_an_unknown_token_is_not_found(monkeypatch):
    class Empty:
        def table(self, _name):
            return self

        def select(self, *_a, **_k):
            return self

        def eq(self, *_a):
            return self

        def limit(self, *_a):
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    with pytest.raises(HTTPException) as error:
        decide_family_plan("wrong-token", PlanDecisionRequest(decision="approved"), Empty())

    assert error.value.status_code == 404


def test_a_signed_in_account_cannot_shortcut_the_family_decision(monkeypatch):
    monkeypatch.setattr(routes, "require_plan_access", lambda *_args: 1)

    class Client:
        def table(self, _name):
            return self

        def select(self, *_a, **_k):
            return self

        def eq(self, *_a):
            return self

        def limit(self, *_a):
            return self

        def execute(self):
            return SimpleNamespace(data=[{"status": "awaiting_approval"}])

    with pytest.raises(HTTPException) as error:
        update_plan(9, PlanUpdate(status="approved"), USER, Client())

    assert error.value.status_code == 403


def test_a_decision_token_is_stored_only_as_a_digest():
    assert digest(TOKEN) != TOKEN
    assert len(digest(TOKEN)) == 64


# --- Telling everyone --------------------------------------------------------------


def test_every_family_member_and_the_older_adult_are_emailed(monkeypatch):
    client = DecisionClient()
    record_sends(monkeypatch, client)

    result = decide_family_plan(TOKEN, PlanDecisionRequest(decision="approved"), client)

    assert sorted(client.sent) == ["anna@example.com", "david@example.com", "mary@example.com"]
    assert {item["status"] for item in result["deliveries"]} == {"sent"}


def test_a_failed_decision_email_is_recorded_and_never_reported_as_sent(monkeypatch):
    client = DecisionClient()
    record_sends(monkeypatch, client, failing={"david@example.com"})

    result = decide_family_plan(TOKEN, PlanDecisionRequest(decision="approved"), client)

    failed = [item for item in result["deliveries"] if item["status"] == "failed"]
    assert [item["name"] for item in failed] == ["David Lim"]
    assert "could not be reached" in result["message"]


def test_total_delivery_failure_is_never_described_as_success():
    deliveries = [
        {"recipient_role": "family_member", "name": "Anna", "status": "failed"},
        {"recipient_role": "older_adult", "name": "Mary", "status": "failed"},
    ]

    message = delivery_summary(deliveries)

    assert "no notification email could be sent" in message
    assert "everyone was notified" not in message


def test_full_delivery_is_described_as_success():
    deliveries = [{"recipient_role": "family_member", "name": "Anna", "status": "sent"}]

    assert "everyone was notified" in delivery_summary(deliveries)


def test_a_retry_skips_recipients_that_already_received_the_email():
    deliveries = [
        {"recipient_role": "family_member", "name": "Anna", "status": "already_sent"},
        {"recipient_role": "family_member", "name": "David", "status": "sent"},
    ]

    assert "everyone was notified" in delivery_summary(deliveries)


def test_the_decision_email_names_the_decider_the_outcome_and_the_activity():
    subject, body = decision_message(
        decision="approved",
        decided_by="Anna Lim",
        decided_at="2030-06-01T10:00:00Z",
        person_name="Mary",
        activity=ACTIVITY,
        reason="Happy to drive her.",
    )

    assert "Mary" in subject and "approved" in subject
    assert "Anna Lim" in body
    assert "Chair Yoga" in body
    assert "Tiong Bahru CC" in body
    assert "2030-06-01T10:00:00Z" in body
    assert "Happy to drive her." in body


def test_a_rejection_email_does_not_read_as_an_approval():
    subject, body = decision_message(
        decision="rejected",
        decided_by="David Lim",
        decided_at="2030-06-01T10:00:00Z",
        person_name="Mary",
        activity=ACTIVITY,
    )

    assert "not approved" in subject
    assert "rejected" in body
