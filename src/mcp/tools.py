"""PeiPal MCP tool registrations."""

from __future__ import annotations

from typing import Any, Literal

from mcp.server.fastmcp import FastMCP

from src.mcp.backend import PeiPalApi, PeiPalApiError, filter_activities


def _error(error: PeiPalApiError) -> dict[str, Any]:
    return {"ok": False, "error": error.detail, "status_code": error.status_code}


def register_tools(mcp: FastMCP, api: PeiPalApi | None = None) -> None:
    backend = api or PeiPalApi()

    @mcp.tool()
    async def search_activities(
        location: str | None = None,
        interest: str | None = None,
        max_cost: float | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        """Find upcoming activities. Search before proposing or creating a plan."""
        try:
            safe_limit = max(1, min(limit, 20))
            payload = await backend.request(
                "GET",
                "/api/activities",
                params={
                    "limit": safe_limit,
                    **({"location": location.strip()} if location and location.strip() else {}),
                },
            )
            activities = filter_activities(
                payload.get("activities", []), interest=interest, max_cost=max_cost
            )
            return {"ok": True, "activities": activities[:safe_limit], "count": len(activities[:safe_limit])}
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def list_households() -> dict[str, Any]:
        """List households available to the authenticated demo user."""
        try:
            return {"ok": True, **(await backend.request("GET", "/api/households"))}
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def list_older_adults(household_id: int) -> dict[str, Any]:
        """List older-adult profiles in a household before creating a plan."""
        try:
            return {
                "ok": True,
                **(await backend.request("GET", f"/api/households/{household_id}/older-adults")),
            }
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def create_plan(
        household_id: int,
        older_adult_id: int,
        activity_id: int,
    ) -> dict[str, Any]:
        """Create a plan only after confirming the selected activity and person."""
        try:
            plan = await backend.request(
                "POST",
                "/api/plans",
                json={
                    "household_id": household_id,
                    "older_adult_id": older_adult_id,
                    "activity_id": activity_id,
                },
            )
            return {"ok": True, "plan": plan}
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def get_plan(plan_id: int) -> dict[str, Any]:
        """Retrieve one plan and its current approval status."""
        try:
            return {"ok": True, "plan": await backend.request("GET", f"/api/plans/{plan_id}")}
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def update_plan(
        plan_id: int,
        status: Literal["awaiting_approval", "shared", "cancelled"],
    ) -> dict[str, Any]:
        """Move a plan through approval, sharing, or cancellation."""
        try:
            return {
                "ok": True,
                "plan": await backend.request(
                    "PATCH", f"/api/plans/{plan_id}", json={"status": status}
                ),
            }
        except PeiPalApiError as error:
            return _error(error)
