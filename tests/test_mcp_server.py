import asyncio
import os

os.environ.setdefault("MCP_ACCESS_TOKEN", "mcp-test-token")
os.environ.setdefault("COUNT_ME_IN_API_TOKEN", "api-test-token")

from mcp.server.fastmcp import FastMCP
from starlette.testclient import TestClient

from src.mcp.backend import CountMeInApiError, filter_activities
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
        "list_households",
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


def test_household_lookup_and_plan_creation_forward_to_api():
    fake = FakeApi({
        ("GET", "/api/households"): {"households": [{"id": 3}]},
        ("GET", "/api/households/3/older-adults"): {"older_adults": [{"id": 8}]},
        ("POST", "/api/plans"): {"id": 22, "status": "draft"},
    })
    assert call_tool(fake, "list_households", {})["households"] == [{"id": 3}]
    assert call_tool(fake, "list_older_adults", {"household_id": 3})["older_adults"] == [{"id": 8}]
    result = call_tool(fake, "create_plan", {"household_id": 3, "older_adult_id": 8, "activity_id": 1})
    assert result == {"ok": True, "plan": {"id": 22, "status": "draft"}}


def test_backend_errors_are_returned_without_claiming_success():
    result = call_tool(
        FakeApi(error=CountMeInApiError(404, "Active activity not found.")),
        "create_plan",
        {"household_id": 3, "older_adult_id": 8, "activity_id": 999},
    )
    assert result == {"ok": False, "error": "Active activity not found.", "status_code": 404}


def test_filter_activities_handles_missing_cost():
    assert filter_activities([{"id": 1, "name": "Free", "cost": None}], max_cost=0)


def test_mcp_rejects_invalid_bearer_token():
    with TestClient(app) as client:
        response = client.get("/mcp/", headers={"Authorization": "Bearer wrong"})
    assert response.status_code == 401
