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
            "Then call recommend_activity_for_person and present up to three suitable options with reasons. "
            "Use explain_activity_match when the family asks why an option fits. Confirm the "
            "selected activity and older-adult profile before calling prepare_family_approval. "
            "Use confirm_activity_plan only after the family explicitly approves. Never invent IDs "
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

    @mcp.resource("peipal://families")
    async def families_resource() -> str:
        """Read families available to the authenticated demo user."""
        try:
            return json.dumps(await backend.request("GET", "/api/families"))
        except PeiPalApiError as error:
            return json.dumps({"error": error.detail, "status_code": error.status_code})

    @mcp.resource("peipal://families/{family_id}/older-adults")
    async def older_adults_resource(family_id: int) -> str:
        """Read older-adult profiles for one family."""
        try:
            result = await backend.request(
                "GET", f"/api/families/{family_id}/older-adults"
            )
            return json.dumps(result)
        except PeiPalApiError as error:
            return json.dumps({"error": error.detail, "status_code": error.status_code})
