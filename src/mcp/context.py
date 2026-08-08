"""MCP prompt registration."""

from __future__ import annotations

import json

from mcp.server.fastmcp import FastMCP


def register_context(mcp: FastMCP) -> None:
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
            "selected activity and older-adult profile before calling prepare_family_approval — "
            "that call creates the plan and emails the family in one step; there is no separate "
            "approval-request call. Only the family member holding their emailed link can approve "
            "or reject, never this tool. Use get_plan_coordination to check whether they have, and "
            "mark_plan_completed only once they've said yes. Never invent IDs or claim a write "
            "succeeded without a successful tool response.\n\n"
            f"Known preferences: {json.dumps(details)}"
        )
