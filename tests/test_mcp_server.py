import asyncio
import os

os.environ.setdefault("MCP_ACCESS_TOKEN", "mcp-test-token")
os.environ.setdefault("PEIPAL_API_TOKEN", "api-test-token")

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


def call_tool(fake, name, arguments):
    server = FastMCP("test")
    register_tools(server, fake)
    return asyncio.run(server._tool_manager.call_tool(name, arguments))


def test_tool_discovery_exposes_expected_tools():
    from src.mcp.server import mcp

    assert {tool.name for tool in mcp._tool_manager.list_tools()} == {
        "search_activities",
        "recommend_activities",
        "recommend_activity_for_person",
        "prepare_family_approval",
        "confirm_activity_plan",
        "explain_activity_match",
        "list_families",
        "list_older_adults",
        "create_plan",
        "get_plan",
        "update_plan",
    }


def test_search_filters_interest_and_cost_and_clamps_limit():
    fake = FakeApi({
        ("GET", "/api/activities"): {
            "activities": [
                {"id": 1, "name": "Chair Yoga", "cost": 5, "tags": ["movement"]},
                {"id": 2, "name": "Dance", "cost": 15, "tags": ["movement"]},
            ]
        }
    })
    result = call_tool(fake, "search_activities", {"interest": "movement", "max_cost": 10, "limit": 99})
    assert result["ok"] is True
    assert [activity["id"] for activity in result["activities"]] == [1]
    assert fake.calls[0][2]["params"]["limit"] == 20


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


def test_task_tools_prepare_and_confirm_family_plan():
    fake = FakeApi({
        ("GET", "/api/older-adults/8"): {"id": 8, "family_id": 3},
        ("POST", "/api/plans"): {"id": 22, "status": "draft"},
        ("PATCH", "/api/plans/22"): {"id": 22, "status": "awaiting_approval"},
    })
    prepared = call_tool(fake, "prepare_family_approval", {"activity_id": 1, "older_adult_id": 8})
    assert prepared["approval_status"] == "awaiting_approval"
    assert fake.calls[-1][2]["json"] == {"status": "awaiting_approval"}

    fake.responses[("PATCH", "/api/plans/22")] = {"id": 22, "status": "shared"}
    confirmed = call_tool(fake, "confirm_activity_plan", {"plan_id": 22})
    assert confirmed["plan"]["status"] == "shared"


def test_backend_errors_are_returned_without_claiming_success():
    result = call_tool(
        FakeApi(error=PeiPalApiError(404, "Active activity not found.")),
        "create_plan",
        {"family_id": 3, "older_adult_id": 8, "activity_id": 999},
    )
    assert result == {"ok": False, "error": "Active activity not found.", "status_code": 404}


def test_filter_activities_handles_missing_cost():
    assert filter_activities([{"id": 1, "name": "Free", "cost": None}], max_cost=0)


def test_mcp_rejects_invalid_bearer_token():
    with TestClient(app) as client:
        response = client.get("/mcp/", headers={"Authorization": "Bearer wrong"})
    assert response.status_code == 401
