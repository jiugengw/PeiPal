import asyncio
from types import SimpleNamespace

from mcp.server.fastmcp import FastMCP
from starlette.testclient import TestClient

from src.mcp.backend import PeiPalApiError, filter_activities
from src.mcp.server import app
from src.mcp.tools import register_tools


class FakeApi:
    def __init__(self, responses=None, error=None):
        self.responses = responses or {}
        self.error = error
        self.calls = []

    async def request(self, method, path, **kwargs):
        self.calls.append((method, path, kwargs))
        if self.error:
            raise self.error
        return self.responses.get((method, path), {})


class FakeContext:
    """Stands in for FastMCP's Context, exposing just the header lookup tools use."""

    def __init__(self, token="t"):
        self.request_context = SimpleNamespace(
            request=SimpleNamespace(headers={"authorization": f"Bearer {token}"})
        )


def call_tool(fake, name, arguments, token="t"):
    server = FastMCP("test")
    register_tools(server, fake)
    return asyncio.run(
        server._tool_manager.call_tool(name, arguments, context=FakeContext(token))
    )


def test_tool_discovery_exposes_expected_tools():
    from src.mcp.server import mcp

    assert {tool.name for tool in mcp._tool_manager.list_tools()} == {
        "search_activities",
        "recommend_activities",
        "recommend_activity_for_person",
        "prepare_family_approval",
        "get_plan_coordination",
        "mark_plan_completed",
        "explain_activity_match",
        "list_families",
        "list_older_adults",
        "create_plan",
        "get_plan",
        "cancel_plan",
        "create_family",
        "create_older_adult",
        "add_family_member",
        "update_family_member",
    }


def test_no_tool_advertises_a_token_argument():
    """The whole point of the personal-access-token design: nothing an LLM
    could see, carry, or mistype as a tool argument."""
    server = FastMCP("test")
    register_tools(server, FakeApi())
    for tool in server._tool_manager.list_tools():
        assert "token" not in tool.parameters.get("properties", {})
        assert "ctx" not in tool.parameters.get("properties", {})


def test_search_filters_interest_and_cost_and_clamps_limit():
    fake = FakeApi({
        ("GET", "/api/activities"): {
            "activities": [
                {"id": 1, "name": "Chair Yoga", "cost": 5, "tags": ["movement"]},
                {"id": 2, "name": "Dance", "cost": 15, "tags": ["movement"]},
            ]
        }
    })
    result = call_tool(
        fake, "search_activities", {"interest": "movement", "max_cost": 10, "limit": 99}, token="t"
    )
    assert result["ok"] is True
    assert [activity["id"] for activity in result["activities"]] == [1]
    assert fake.calls[0][2]["params"]["limit"] == 20
    assert fake.calls[0][2]["token"] == "t"


def test_family_lookup_and_plan_creation_forward_to_api():
    fake = FakeApi({
        ("GET", "/api/families"): {"families": [{"id": 3}]},
        ("GET", "/api/families/3/older-adults"): {"older_adults": [{"id": 8}]},
        ("POST", "/api/plans"): {"id": 22, "status": "draft"},
    })
    assert call_tool(fake, "list_families", {})["families"] == [{"id": 3}]
    assert call_tool(fake, "list_older_adults", {"family_id": 3})["older_adults"] == [{"id": 8}]
    result = call_tool(fake, "create_plan", {"family_id": 3, "older_adult_id": 8, "activity_id": 1})
    assert result == {"ok": True, "plan": {"id": 22, "status": "draft"}}
    assert fake.calls[0][2]["token"] == "t"


def test_plan_creation_looks_up_family_when_workbuddy_omits_it():
    fake = FakeApi({
        ("GET", "/api/older-adults/29"): {"id": 29, "family_id": 3},
        ("POST", "/api/plans"): {"id": 23, "status": "coordinating"},
    })

    result = call_tool(
        fake,
        "create_plan",
        {"older_adult_id": 29, "activity_id": 26},
    )

    assert result == {
        "ok": True,
        "plan": {"id": 23, "status": "coordinating"},
    }
    assert fake.calls == [
        ("GET", "/api/older-adults/29", {"token": "t"}),
        (
            "POST",
            "/api/plans",
            {
                "token": "t",
                "json": {
                    "family_id": 3,
                    "older_adult_id": 29,
                    "activity_id": 26,
                },
            },
        ),
    ]


def test_recommendation_tool_forwards_person_specific_request():
    fake = FakeApi({
        ("GET", "/api/older-adults/8/recommendations"): {
            "recommendations": [{"activity": {"id": 1}, "recommendation_score": 92, "match_factors": {"interest_match": 100}}]
        }
    })
    result = call_tool(fake, "recommend_activities", {
        "older_adult_id": 8,
        "interest": "music",
        "max_cost": 10,
        "limit": 3,
    })
    assert result["ok"] is True
    assert result["recommendations"][0]["recommendation_score"] == 92
    assert fake.calls[0][2]["params"] == {"limit": 3, "interest": "music", "max_cost": 10}


def test_prepare_family_approval_creates_a_plan_and_reports_whether_the_family_was_notified():
    fake = FakeApi({
        ("GET", "/api/older-adults/8"): {"id": 8, "family_id": 3},
        ("POST", "/api/plans"): {"id": 22, "status": "coordinating"},
    })
    prepared = call_tool(fake, "prepare_family_approval", {"activity_id": 1, "older_adult_id": 8})
    assert prepared["approval_status"] == "coordinating"
    assert "awaiting their decision" in prepared["message"]
    # No further write beyond the single create — the backend already emailed
    # the family as part of creating the plan.
    assert fake.calls[-1][:2] == ("POST", "/api/plans")


def test_prepare_family_approval_reports_when_the_family_could_not_be_notified():
    fake = FakeApi({
        ("GET", "/api/older-adults/8"): {"id": 8, "family_id": 3},
        ("POST", "/api/plans"): {"id": 22, "status": "draft"},
    })
    prepared = call_tool(fake, "prepare_family_approval", {"activity_id": 1, "older_adult_id": 8})
    assert prepared["approval_status"] == "draft"
    assert "notifying the family failed" in prepared["message"]


def test_get_plan_coordination_and_mark_plan_completed_forward_to_api():
    fake = FakeApi({
        ("GET", "/api/plans/22/coordination"): {"plan_status": "ready", "tasks": []},
        ("POST", "/api/plans/22/complete"): {"id": 22, "status": "completed"},
    })
    coordination = call_tool(fake, "get_plan_coordination", {"plan_id": 22})
    assert coordination["coordination"]["plan_status"] == "ready"

    completed = call_tool(fake, "mark_plan_completed", {"plan_id": 22})
    assert completed["plan"]["status"] == "completed"


def test_cancel_plan_forwards_to_api():
    fake = FakeApi({("PATCH", "/api/plans/22"): {"id": 22, "status": "cancelled"}})
    result = call_tool(fake, "cancel_plan", {"plan_id": 22})
    assert result["plan"]["status"] == "cancelled"
    assert fake.calls[0][2]["json"] == {"status": "cancelled"}


def test_backend_errors_are_returned_without_claiming_success():
    result = call_tool(
        FakeApi(error=PeiPalApiError(404, "Active activity not found.")),
        "create_plan",
        {"family_id": 3, "older_adult_id": 8, "activity_id": 999},
    )
    assert result == {"ok": False, "error": "Active activity not found.", "status_code": 404}


def test_setup_tools_forward_to_api_with_caregiver_token():
    fake = FakeApi({
        ("POST", "/api/families"): {"id": 3, "name": "Tan Family"},
        ("POST", "/api/older-adults"): {"id": 8, "family_id": 3, "name": "Grandma Tan"},
        ("POST", "/api/family-members"): {"id": 12, "family_id": 3, "name": "Alex Tan"},
        ("PATCH", "/api/family-members/12"): {"id": 12, "family_id": 3, "name": "Alex T."},
    })

    family = call_tool(fake, "create_family", {"name": "Tan Family"})
    assert family == {"ok": True, "family": {"id": 3, "name": "Tan Family"}}

    older_adult = call_tool(
        fake,
        "create_older_adult",
        {"family_id": 3, "name": "Grandma Tan", "preferred_name": "Grandma"},
    )
    assert older_adult["ok"] is True
    assert older_adult["older_adult"]["id"] == 8

    member = call_tool(
        fake,
        "add_family_member",
        {
            "family_id": 3,
            "name": "Alex Tan",
            "email": "alex@example.com",
            "relationships": [{"older_adult_id": 8, "relationship": "grandchild"}],
        },
    )
    assert member["ok"] is True
    assert member["family_member"]["id"] == 12

    updated = call_tool(fake, "update_family_member", {"family_member_id": 12, "name": "Alex T."})
    assert updated["family_member"]["name"] == "Alex T."

    for _, _, kwargs in fake.calls:
        assert kwargs["token"] == "t"


def test_different_callers_never_share_a_token():
    """Each call reads its own connection's Authorization header, not a
    shared/cached value — two different callers get two different tokens."""
    fake = FakeApi({("GET", "/api/families"): {"families": []}})

    call_tool(fake, "list_families", {}, token="caregiver-a-token")
    call_tool(fake, "list_families", {}, token="caregiver-b-token")

    assert fake.calls[0][2]["token"] == "caregiver-a-token"
    assert fake.calls[1][2]["token"] == "caregiver-b-token"


def test_filter_activities_handles_missing_cost():
    assert filter_activities([{"id": 1, "name": "Free", "cost": None}], max_cost=0)


def test_mcp_endpoint_has_no_transport_level_gate():
    """MCP_ACCESS_TOKEN is gone; tool discovery is public, actual data access
    is still gated per-call by the personal access token each tool reads."""
    with TestClient(app) as client:
        response = client.post(
            "/mcp/",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "test", "version": "0"},
                },
            },
            headers={"Accept": "application/json, text/event-stream"},
        )
    assert response.status_code == 200
