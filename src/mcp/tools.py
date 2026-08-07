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
    async def recommend_activities(
        older_adult_id: int,
        location: str | None = None,
        interest: str | None = None,
        max_cost: float | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        """Get PeiPal-computed personalized recommendations for one older adult."""
        try:
            safe_limit = max(1, min(limit, 20))
            result = await backend.request(
                "GET",
                f"/api/older-adults/{older_adult_id}/recommendations",
                params={
                    "limit": safe_limit,
                    **({"location": location.strip()} if location and location.strip() else {}),
                    **({"interest": interest.strip()} if interest and interest.strip() else {}),
                    **({"max_cost": max_cost} if max_cost is not None else {}),
                },
            )
            return {"ok": True, **result}
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def recommend_activity_for_person(
        older_adult_id: int,
        interests: list[str] | None = None,
        max_cost: float | None = None,
        mobility: str | None = None,
        location: str | None = None,
        limit: int = 3,
    ) -> dict[str, Any]:
        """Recommend activities for one person using PeiPal's deterministic score."""
        try:
            safe_limit = max(1, min(limit, 3))
            result = await backend.request(
                "GET",
                f"/api/older-adults/{older_adult_id}/recommendations",
                params={
                    "older_adult_id": older_adult_id,
                    "limit": safe_limit,
                    **({"interest": " ".join(interests)} if interests else {}),
                    **({"mobility": mobility} if mobility else {}),
                    **({"location": location} if location else {}),
                    **({"max_cost": max_cost} if max_cost is not None else {}),
                },
            )
            return {
                "ok": True,
                "recommendations": result.get("recommendations", []),
                "next_step": "Ask the family to choose one recommendation before preparing approval.",
            }
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def prepare_family_approval(
        activity_id: int,
        older_adult_id: int,
    ) -> dict[str, Any]:
        """Validate an activity/person pair and prepare a plan for family approval."""
        try:
            profile = await backend.request("GET", f"/api/older-adults/{older_adult_id}")
            plan = await backend.request(
                "POST",
                "/api/plans",
                json={
                    "household_id": profile["household_id"],
                    "older_adult_id": older_adult_id,
                    "activity_id": activity_id,
                },
            )
            if plan.get("status") == "draft":
                plan = await backend.request(
                    "PATCH", f"/api/plans/{plan['id']}", json={"status": "awaiting_approval"}
                )
            return {
                "ok": True,
                "plan": plan,
                "approval_status": plan.get("status"),
                "message": "The activity is ready for family approval.",
            }
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def confirm_activity_plan(plan_id: int) -> dict[str, Any]:
        """Confirm a family-approved plan and share it with the household."""
        try:
            plan = await backend.request(
                "PATCH", f"/api/plans/{plan_id}", json={"status": "shared"}
            )
            return {"ok": True, "plan": plan, "message": "The activity plan is confirmed and shared."}
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def explain_activity_match(
        activity_id: int,
        older_adult_id: int,
        interests: list[str] | None = None,
        max_cost: float | None = None,
        mobility: str | None = None,
        location: str | None = None,
    ) -> dict[str, Any]:
        """Return PeiPal's score factors for WorkBuddy to explain in plain language."""
        try:
            result = await backend.request(
                "GET",
                f"/api/older-adults/{older_adult_id}/recommendations",
                params={
                    "activity_id": activity_id,
                    "limit": 1,
                    **({"interest": " ".join(interests)} if interests else {}),
                    **({"mobility": mobility} if mobility else {}),
                    **({"location": location} if location else {}),
                    **({"max_cost": max_cost} if max_cost is not None else {}),
                },
            )
            recommendation = (result.get("recommendations") or [None])[0]
            if recommendation is None:
                return {"ok": False, "error": "No active matching activity was found."}
            return {
                "ok": True,
                "recommendation_score": recommendation["recommendation_score"],
                "match_factors": recommendation["match_factors"],
                "activity": recommendation["activity"],
                "instruction": "Explain these factors without changing the numeric score.",
            }
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
