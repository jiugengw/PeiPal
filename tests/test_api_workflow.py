import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from types import SimpleNamespace

from src.api.main import app
from src.api.models import OlderAdultCreate, PlanCreate, PlanUpdate
from src.api import routes
from src.api.routes import get_activity, update_plan


client = TestClient(app)


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/me"),
        ("get", "/api/families"),
        ("get", "/api/families/1"),
        ("get", "/api/families/1/family-members"),
        ("post", "/api/family-members"),
        ("patch", "/api/family-members/1"),
        ("delete", "/api/family-members/1"),
        ("get", "/api/older-adults/1"),
        ("patch", "/api/older-adults/1"),
        ("post", "/api/plans"),
        ("get", "/api/plans?family_id=1"),
        ("get", "/api/plans/1"),
        ("patch", "/api/plans/1"),
        ("post", "/api/plans/1/coordination"),
        ("get", "/api/plans/1/coordination"),
        ("post", "/api/plans/1/complete"),
        ("post", "/api/voice/session"),
        ("post", "/api/workbuddy/tokens"),
        ("get", "/api/workbuddy/tokens"),
        ("delete", "/api/workbuddy/tokens/1"),
    ],
)
def test_protected_routes_require_authentication(method, path):
    response = getattr(client, method)(path)

    assert response.status_code == 401


def test_plan_create_requires_the_three_relationship_ids():
    with pytest.raises(ValidationError):
        PlanCreate(family_id=1, older_adult_id=1)


def test_an_older_adult_needs_only_a_family_and_a_name():
    """Sharing modes are gone: every plan goes to the whole family."""

    profile = OlderAdultCreate(family_id=1, name="Mary Lim")

    assert profile.family_id == 1
    assert not hasattr(profile, "sharing_mode")


def test_cancelling_is_the_only_direct_status_change():
    """Approving, rejecting, and completing all belong to coordination."""

    PlanUpdate(status="cancelled")
    for blocked in ["coordinating", "ready", "completed", "rejected", "draft"]:
        with pytest.raises(ValidationError):
            PlanUpdate(status=blocked)


@pytest.mark.parametrize(
    "path,method,status_code,schema_name",
    [
        ("/api/me", "get", "200", "ViewerResponse"),
        ("/api/families", "get", "200", "FamilyListResponse"),
        ("/api/families/{family_id}", "get", "200", "FamilyResponse"),
        ("/api/families/{family_id}/older-adults", "get", "200", "OlderAdultListResponse"),
        ("/api/families/{family_id}/family-members", "get", "200", "FamilyMemberListResponse"),
        ("/api/family-members/{family_member_id}", "patch", "200", "FamilyMemberResponse"),
        ("/api/plans", "post", "201", "PlanResponse"),
        ("/api/plans/{plan_id}", "patch", "200", "PlanResponse"),
        ("/api/plans/{plan_id}/coordination", "post", "200", "CoordinationLaunchResponse"),
        ("/api/plans/{plan_id}/coordination", "get", "200", "CoordinationStateResponse"),
        ("/api/coordination/{token}", "get", "200", "CoordinationStateResponse"),
        ("/api/coordination/{token}/tasks/{task_type}", "post", "200", "CoordinationStateResponse"),
        ("/api/activities/{activity_id}", "get", "200", "ActivityResponse"),
    ],
)
def test_routes_publish_typed_openapi_responses(path, method, status_code, schema_name):
    schema = app.openapi()["paths"][path][method]["responses"][status_code]["content"]["application/json"]["schema"]

    assert schema["$ref"] == f"#/components/schemas/{schema_name}"


def test_no_trusted_contact_routes_remain():
    paths = app.openapi()["paths"]

    assert not [path for path in paths if "trusted" in path]
    assert not [name for name in app.openapi()["components"]["schemas"] if "Trusted" in name]


def test_coordination_links_are_reachable_without_a_session():
    """Family members hold no account, so their link carries the identity."""

    paths = app.openapi()["paths"]
    for path in ["/api/coordination/{token}", "/api/coordination/{token}/tasks/{task_type}"]:
        for operation in paths[path].values():
            assert "security" not in operation


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


def test_an_active_plan_can_be_cancelled(monkeypatch):
    monkeypatch.setattr(routes, "require_plan_access", lambda *_args: 1)
    cancelled = {"id": 9, "family_id": 1, "status": "cancelled"}

    result = update_plan(
        9,
        PlanUpdate(status="cancelled"),
        SimpleNamespace(id="user-1"),
        QueueClient([[{"status": "coordinating"}], [cancelled]]),
    )

    assert result == cancelled


def test_a_settled_plan_cannot_be_cancelled_again(monkeypatch):
    monkeypatch.setattr(routes, "require_plan_access", lambda *_args: 1)

    for settled in ["completed", "rejected", "cancelled"]:
        with pytest.raises(HTTPException) as error:
            update_plan(
                9,
                PlanUpdate(status="cancelled"),
                SimpleNamespace(id="user-1"),
                QueueClient([[{"status": settled}]]),
            )

        assert error.value.status_code == 409
