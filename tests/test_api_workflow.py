import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from types import SimpleNamespace

from src.api.main import app
from src.api.models import OlderAdultCreate, PlanCreate, PlanNotificationCreate, PlanUpdate, SupportOfferCreate
from src.api import routes
from src.api.routes import create_support_offer, get_activity, send_plan_notifications, update_plan, withdraw_support_offer


client = TestClient(app)


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/families"),
        ("get", "/api/families/1"),
        ("get", "/api/older-adults/1"),
        ("patch", "/api/older-adults/1"),
        ("post", "/api/plans"),
        ("get", "/api/plans?family_id=1"),
        ("get", "/api/plans/1"),
        ("patch", "/api/plans/1"),
        ("post", "/api/plans/1/support-offers"),
        ("get", "/api/plans/1/support-offers"),
        ("post", "/api/plans/1/notifications"),
        ("get", "/api/plans/1/notifications"),
        ("post", "/api/voice/session"),
    ],
)
def test_core_workflow_requires_authentication(method, path):
    response = getattr(client, method)(path)

    assert response.status_code == 401


def test_plan_create_requires_the_three_relationship_ids():
    with pytest.raises(ValidationError):
        PlanCreate(family_id=1, older_adult_id=1)


def test_support_offer_rejects_unknown_support_type():
    with pytest.raises(ValidationError):
        SupportOfferCreate(support_type="send_money")


def test_older_adult_sharing_mode_defaults_to_family_approval():
    profile = OlderAdultCreate(family_id=1, name="Mary Lim")

    assert profile.sharing_mode == "family_approval"


def test_plan_notification_requires_at_least_one_contact():
    with pytest.raises(ValidationError):
        PlanNotificationCreate(family_member_ids=[])


@pytest.mark.parametrize(
    "path,method,status_code,schema_name",
    [
        ("/api/families", "get", "200", "FamilyListResponse"),
        ("/api/families/{family_id}", "get", "200", "FamilyResponse"),
        ("/api/families/{family_id}/older-adults", "get", "200", "OlderAdultListResponse"),
        ("/api/older-adults/{older_adult_id}", "patch", "200", "OlderAdultResponse"),
        ("/api/families/{family_id}/family-members", "get", "200", "FamilyMemberListResponse"),
        ("/api/family-members/{family_member_id}", "patch", "200", "FamilyMemberResponse"),
        ("/api/plans", "post", "201", "PlanResponse"),
        ("/api/plans", "get", "200", "PlanListResponse"),
        ("/api/plans/{plan_id}", "get", "200", "PlanResponse"),
        ("/api/plans/{plan_id}", "patch", "200", "PlanResponse"),
        ("/api/plans/{plan_id}/support-offers", "post", "201", "SupportOfferResponse"),
        ("/api/plans/{plan_id}/support-offers", "get", "200", "SupportOfferListResponse"),
        ("/api/plans/{plan_id}/notifications", "post", "200", "NotificationDeliveryListResponse"),
        ("/api/plans/{plan_id}/notifications", "get", "200", "PlanNotificationListResponse"),
        ("/api/activities/{activity_id}", "get", "200", "ActivityResponse"),
        ("/api/voice/session", "post", "200", "VoiceSessionResponse"),
    ],
)
def test_setup_routes_publish_typed_openapi_responses(path, method, status_code, schema_name):
    response_schema = app.openapi()["paths"][path][method]["responses"][status_code]["content"]["application/json"]["schema"]

    assert response_schema["$ref"] == f"#/components/schemas/{schema_name}"


def test_activity_detail_returns_an_expired_activity_for_existing_plans():
    activity = {"id": 7, "status": "expired", "name": "Past activity"}

    class Query:
        def select(self, *_args): return self
        def eq(self, field, value):
            assert (field, value) == ("id", 7)
            return self
        def limit(self, value):
            assert value == 1
            return self
        def execute(self): return type("Result", (), {"data": [activity]})()

    class Client:
        def table(self, name):
            assert name == "activities"
            return Query()

    assert get_activity(7, Client()) == activity


def test_withdrawn_support_offer_is_reactivated(monkeypatch):
    monkeypatch.setattr(routes, "require_plan_access", lambda *_args: 1)
    updated_values = {}

    class Query:
        def __init__(self, table):
            self.table = table
            self.operation = "select"

        def select(self, *_args): return self
        def eq(self, *_args): return self
        def limit(self, *_args): return self
        def update(self, values):
            self.operation = "update"
            updated_values.update(values)
            return self
        def execute(self):
            if self.table == "plans":
                return SimpleNamespace(data=[{"status": "shared"}])
            if self.operation == "select":
                return SimpleNamespace(data=[{"id": 4, "status": "withdrawn"}])
            return SimpleNamespace(data=[{
                "id": 4,
                "plan_id": 9,
                "offered_by": "user-1",
                **updated_values,
            }])

    class Client:
        def table(self, name): return Query(name)

    result = create_support_offer(
        9,
        SupportOfferCreate(support_type="transport", note="I can drive."),
        SimpleNamespace(id="user-1"),
        Client(),
    )

    assert result["id"] == 4
    assert updated_values["status"] == "offered"
    assert updated_values["note"] == "I can drive."


class QueueQuery:
    def __init__(self, responses):
        self.responses = responses

    def select(self, *_args): return self
    def insert(self, *_args): return self
    def update(self, *_args): return self
    def eq(self, *_args): return self
    def in_(self, *_args): return self
    def limit(self, *_args): return self
    def order(self, *_args, **_kwargs): return self
    def execute(self): return SimpleNamespace(data=self.responses.pop(0))


class QueueClient:
    def __init__(self, responses): self.responses = list(responses)
    def table(self, _name): return QueueQuery(self.responses)


def test_plan_can_move_from_awaiting_approval_to_shared(monkeypatch):
    monkeypatch.setattr(routes, "require_plan_access", lambda *_args: 1)
    monkeypatch.setattr(routes, "require_family_owner", lambda *_args: None)
    shared = {"id": 9, "family_id": 1, "status": "shared"}

    result = update_plan(
        9,
        PlanUpdate(status="shared"),
        SimpleNamespace(id="user-1"),
        QueueClient([[{"status": "awaiting_approval"}], [shared]]),
    )

    assert result == shared


def test_plan_rejects_an_invalid_status_transition(monkeypatch):
    monkeypatch.setattr(routes, "require_plan_access", lambda *_args: 1)

    with pytest.raises(HTTPException) as error:
        update_plan(
            9,
            PlanUpdate(status="awaiting_approval"),
            SimpleNamespace(id="user-1"),
            QueueClient([[{"status": "shared"}]]),
        )

    assert error.value.status_code == 409


def test_notifications_reject_a_plan_that_is_not_shared(monkeypatch):
    monkeypatch.setattr(routes, "require_plan_access", lambda *_args: 1)

    with pytest.raises(HTTPException) as error:
        send_plan_notifications(
            9,
            PlanNotificationCreate(family_member_ids=[1]),
            SimpleNamespace(id="user-1"),
            QueueClient([[{"status": "draft", "older_adult_id": 2, "activity_id": 3}]]),
        )

    assert error.value.status_code == 409


def test_notifications_preserve_sent_contacts_and_report_partial_failure(monkeypatch):
    monkeypatch.setattr(routes, "require_plan_access", lambda *_args: 1)
    monkeypatch.setattr(routes, "send_plan_email", lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("provider failed")))
    client = QueueClient([
        [{"status": "shared", "older_adult_id": 2, "activity_id": 3}],
        [{"id": 1, "name": "Anna", "email": "anna@example.com"}, {"id": 2, "name": "David", "email": "david@example.com"}],
        [{"name": "Mary", "preferred_name": "Mary"}],
        [{"name": "Yoga", "location": "Bishan", "start_at": "2030-01-01", "info_link": "https://example.com"}],
        [{"id": 10, "status": "sent"}],
        [{"id": 11, "status": "failed"}],
        [{}],
        [{}],
    ])

    result = send_plan_notifications(
        9,
        PlanNotificationCreate(family_member_ids=[1, 2]),
        SimpleNamespace(id="user-1"),
        client,
    )

    assert result["deliveries"] == [
        {"family_member_id": 1, "name": "Anna", "status": "already_sent"},
        {"family_member_id": 2, "name": "David", "status": "failed", "error": "Email delivery failed."},
    ]


def test_support_rejects_non_shared_plan(monkeypatch):
    monkeypatch.setattr(routes, "require_plan_access", lambda *_args: 1)

    with pytest.raises(HTTPException) as error:
        create_support_offer(
            9,
            SupportOfferCreate(support_type="join"),
            SimpleNamespace(id="user-1"),
            QueueClient([[{"status": "draft"}]]),
        )

    assert error.value.status_code == 409


def test_support_rejects_duplicate_active_offer(monkeypatch):
    monkeypatch.setattr(routes, "require_plan_access", lambda *_args: 1)

    with pytest.raises(HTTPException) as error:
        create_support_offer(
            9,
            SupportOfferCreate(support_type="join"),
            SimpleNamespace(id="user-1"),
            QueueClient([[{"status": "shared"}], [{"id": 4, "status": "offered"}]]),
        )

    assert error.value.status_code == 409


def test_user_cannot_withdraw_another_accounts_support(monkeypatch):
    monkeypatch.setattr(routes, "require_plan_access", lambda *_args: 1)

    with pytest.raises(HTTPException) as error:
        withdraw_support_offer(
            4,
            SimpleNamespace(id="user-1"),
            QueueClient([[{"plan_id": 9, "offered_by": "user-2"}]]),
        )

    assert error.value.status_code == 403
