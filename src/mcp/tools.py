"""PeiPal MCP tool registrations."""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import Context, FastMCP

from src.mcp.backend import PeiPalApi, PeiPalApiError, filter_activities


def _error(error: PeiPalApiError) -> dict[str, Any]:
    return {"ok": False, "error": error.detail, "status_code": error.status_code}


def _token_from(ctx: Context) -> str:
    """The caller's personal access token, straight from the connection's own
    Authorization header — never a tool argument, so nothing for an LLM to
    carry, remember, or retype between calls."""
    header = ctx.request_context.request.headers.get("authorization", "")
    return header.removeprefix("Bearer ").strip()


def register_tools(mcp: FastMCP, api: PeiPalApi | None = None) -> None:
    backend = api or PeiPalApi()

    @mcp.tool()
    async def search_activities(
        ctx: Context,
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
                token=_token_from(ctx),
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
        ctx: Context,
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
                token=_token_from(ctx),
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
        ctx: Context,
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
                token=_token_from(ctx),
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
        ctx: Context,
        activity_id: int,
        older_adult_id: int,
    ) -> dict[str, Any]:
        """Validate an activity/person pair, create the plan, and notify the
        family for approval — looks up the older adult's family automatically
        so the caller doesn't need to already know the family_id. Creating the
        plan itself sends the family-approval email; there is no separate
        approval-request step, and nothing here can approve on the family's
        behalf — only the family member holding their emailed link can do
        that. Use get_plan_coordination to check whether they have."""
        try:
            token = _token_from(ctx)
            profile = await backend.request(
                "GET", f"/api/older-adults/{older_adult_id}", token=token
            )
            plan = await backend.request(
                "POST",
                "/api/plans",
                token=token,
                json={
                    "family_id": profile["family_id"],
                    "older_adult_id": older_adult_id,
                    "activity_id": activity_id,
                },
            )
            notified = plan.get("status") == "coordinating"
            return {
                "ok": True,
                "plan": plan,
                "approval_status": plan.get("status"),
                "message": (
                    "The family has been emailed and the plan is awaiting their decision."
                    if notified
                    else "The plan was created, but notifying the family failed — it stayed "
                    "a draft. Check delivery, or ask the caregiver to retry from the website."
                ),
            }
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def get_plan_coordination(ctx: Context, plan_id: int) -> dict[str, Any]:
        """Check the family's real decision progress on a plan: who has
        approved or rejected, and what's still open. Use this instead of
        guessing from get_plan's bare status."""
        try:
            state = await backend.request(
                "GET", f"/api/plans/{plan_id}/coordination", token=_token_from(ctx)
            )
            return {"ok": True, "coordination": state}
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def mark_plan_completed(ctx: Context, plan_id: int) -> dict[str, Any]:
        """Mark a plan done once the family has approved it (status "ready").
        This does not approve on the family's behalf — only usable after they
        already have, via get_plan_coordination or get_plan."""
        try:
            plan = await backend.request(
                "POST", f"/api/plans/{plan_id}/complete", token=_token_from(ctx)
            )
            return {"ok": True, "plan": plan, "message": "The activity plan is marked done."}
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def explain_activity_match(
        ctx: Context,
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
                token=_token_from(ctx),
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
    async def list_families(ctx: Context) -> dict[str, Any]:
        """List families the caller belongs to."""
        try:
            return {
                "ok": True,
                **(await backend.request("GET", "/api/families", token=_token_from(ctx))),
            }
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def list_older_adults(ctx: Context, family_id: int) -> dict[str, Any]:
        """List older-adult profiles in a family before creating a plan."""
        try:
            return {
                "ok": True,
                **(
                    await backend.request(
                        "GET", f"/api/families/{family_id}/older-adults", token=_token_from(ctx)
                    )
                ),
            }
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def create_plan(
        ctx: Context,
        older_adult_id: int,
        activity_id: int,
        family_id: int | None = None,
    ) -> dict[str, Any]:
        """Create a plan only after confirming the selected activity and person.
        The older adult's family is looked up automatically when family_id is
        omitted, so callers only need the confirmed person and activity IDs."""
        try:
            token = _token_from(ctx)
            resolved_family_id = family_id
            if resolved_family_id is None:
                profile = await backend.request(
                    "GET", f"/api/older-adults/{older_adult_id}", token=token
                )
                resolved_family_id = profile["family_id"]
            plan = await backend.request(
                "POST",
                "/api/plans",
                token=token,
                json={
                    "family_id": resolved_family_id,
                    "older_adult_id": older_adult_id,
                    "activity_id": activity_id,
                },
            )
            return {"ok": True, "plan": plan}
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def get_plan(ctx: Context, plan_id: int) -> dict[str, Any]:
        """Retrieve one plan and its current approval status."""
        try:
            return {
                "ok": True,
                "plan": await backend.request("GET", f"/api/plans/{plan_id}", token=_token_from(ctx)),
            }
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def cancel_plan(ctx: Context, plan_id: int) -> dict[str, Any]:
        """Cancel a plan that hasn't completed yet. This is the only direct
        status change available — approval and rejection belong to the
        family, and completion happens via mark_plan_completed."""
        try:
            return {
                "ok": True,
                "plan": await backend.request(
                    "PATCH",
                    f"/api/plans/{plan_id}",
                    token=_token_from(ctx),
                    json={"status": "cancelled"},
                ),
            }
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def create_family(ctx: Context, name: str) -> dict[str, Any]:
        """Create a new family. The caller becomes its owner automatically."""
        try:
            family = await backend.request(
                "POST", "/api/families", token=_token_from(ctx), json={"name": name}
            )
            return {"ok": True, "family": family}
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def create_older_adult(
        ctx: Context,
        family_id: int,
        name: str,
        preferred_name: str | None = None,
        age: int | None = None,
        language: str | None = None,
        email: str | None = None,
        mobility_notes: str | None = None,
        transport_notes: str | None = None,
    ) -> dict[str, Any]:
        """Create an older-adult profile in a family. The caller must already
        belong to that family."""
        try:
            older_adult = await backend.request(
                "POST",
                "/api/older-adults",
                token=_token_from(ctx),
                json={
                    "family_id": family_id,
                    "name": name,
                    **({"preferred_name": preferred_name} if preferred_name else {}),
                    **({"age": age} if age is not None else {}),
                    **({"language": language} if language else {}),
                    **({"email": email} if email else {}),
                    **({"mobility_notes": mobility_notes} if mobility_notes else {}),
                    **({"transport_notes": transport_notes} if transport_notes else {}),
                },
            )
            return {"ok": True, "older_adult": older_adult}
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def add_family_member(
        ctx: Context,
        family_id: int,
        name: str,
        email: str,
        relationships: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Add a trusted family member who will receive coordination/approval
        emails. `relationships` is a list of {"older_adult_id": int,
        "relationship": str}."""
        try:
            family_member = await backend.request(
                "POST",
                "/api/family-members",
                token=_token_from(ctx),
                json={
                    "family_id": family_id,
                    "name": name,
                    "email": email,
                    "relationships": relationships,
                },
            )
            return {"ok": True, "family_member": family_member}
        except PeiPalApiError as error:
            return _error(error)

    @mcp.tool()
    async def update_family_member(
        ctx: Context,
        family_member_id: int,
        name: str | None = None,
        email: str | None = None,
        relationships: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Update a trusted family member's details or the older adults they're
        related to."""
        try:
            family_member = await backend.request(
                "PATCH",
                f"/api/family-members/{family_member_id}",
                token=_token_from(ctx),
                json={
                    **({"name": name} if name is not None else {}),
                    **({"email": email} if email is not None else {}),
                    **({"relationships": relationships} if relationships is not None else {}),
                },
            )
            return {"ok": True, "family_member": family_member}
        except PeiPalApiError as error:
            return _error(error)
