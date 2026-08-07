"""MCP prompt and read-only resource registrations."""

from __future__ import annotations

import json
from typing import Any

from mcp.server.fastmcp import FastMCP

from src.mcp.backend import PeiPalApi, PeiPalApiError


def register_context(mcp: FastMCP, api: PeiPalApi | None = None) -> None:
    backend = api or PeiPalApi()

    @mcp.prompt()
    def plan_activity_for_older_adult(
        older_adult_name: str | None = None,
        location: str | None = None,
        interests: str | None = None,
        mobility_needs: str | None = None,
        budget: str | None = None,
    ) -> str:
        """Guide WorkBuddy through finding and preparing an activity plan."""
        details = {
            "older adult": older_adult_name or "not provided",
            "location": location or "not provided",
            "interests": interests or "not provided",
            "mobility needs": mobility_needs or "not provided",
            "budget": budget or "not provided",
        }
        return (
            "Help plan an activity for an older adult. First ask for any missing details. "
            "Then call recommend_activities and present up to three suitable options with reasons. "
            "Confirm the selected activity, household, and older-adult profile before calling "
            "create_plan. Offer family approval by using awaiting_approval. Never invent IDs "
            "or claim a write succeeded without a successful tool response.\n\n"
            f"Known preferences: {json.dumps(details)}"
        )

    @mcp.resource("peipal://activities")
    async def activities_resource() -> str:
        """Read the public upcoming activity catalog."""
        try:
            result = await backend.request("GET", "/api/activities", params={"limit": 20})
            return json.dumps({"activities": result.get("activities", [])})
        except PeiPalApiError as error:
            return json.dumps({"error": error.detail, "status_code": error.status_code})

    @mcp.resource("peipal://households")
    async def households_resource() -> str:
        """Read households available to the authenticated demo user."""
        try:
            return json.dumps(await backend.request("GET", "/api/households"))
        except PeiPalApiError as error:
            return json.dumps({"error": error.detail, "status_code": error.status_code})

    @mcp.resource("peipal://households/{household_id}/older-adults")
    async def older_adults_resource(household_id: int) -> str:
        """Read older-adult profiles for one household."""
        try:
            result = await backend.request(
                "GET", f"/api/households/{household_id}/older-adults"
            )
            return json.dumps(result)
        except PeiPalApiError as error:
            return json.dumps({"error": error.detail, "status_code": error.status_code})
