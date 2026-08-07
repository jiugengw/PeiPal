"""Website API routes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from src.api.dependencies import (
    family_id_for_older_adult,
    get_supabase_client,
    require_family_account,
    require_family_member_access,
    require_family_owner,
    require_older_adult_access,
    require_plan_access,
    require_user,
    user_id,
)
from src.api.models import (
    ActivityListResponse,
    ActivityRecommendationListResponse,
    ActivityResponse,
    FamilyCreate,
    FamilyListResponse,
    FamilyMemberCreate,
    FamilyMemberListResponse,
    FamilyMemberResponse,
    FamilyMemberUpdate,
    CoordinationActionRequest,
    CoordinationLaunchResponse,
    CoordinationStateResponse,
    FamilyResponse,
    FamilyUpdate,
    OlderAdultCreate,
    OlderAdultListResponse,
    OlderAdultResponse,
    OlderAdultUpdate,
    PlanCreate,
    PlanListResponse,
    PlanResponse,
    PlanUpdate,
    ViewerResponse,
    VoiceSessionResponse,
)
from src.services.family_email import digest, expires_in
from src.services.coordination import apply_action, ensure_coordination, load_state
from src.services.coordination_email import send_coordination_emails
from src.services.realtime import create_realtime_client_secret
from src.services.recommendations import recommend_activities


router = APIRouter(prefix="/api")

FAMILY_MEMBER_SELECT = "*, family_member_older_adults(older_adult_id, relationship)"


def _shape_family_member(row: dict[str, Any]) -> dict[str, Any]:
    """Flatten the embedded join rows into the `relationships` field."""

    links = row.pop("family_member_older_adults", None) or []
    row["relationships"] = [
        {"older_adult_id": link["older_adult_id"], "relationship": link["relationship"]}
        for link in links
    ]
    return row


def _validate_older_adults_in_family(
    client: Client, family_id: int, older_adult_ids: list[int]
) -> None:
    """Reject relationships that point outside this family."""

    unique_ids = sorted(set(older_adult_ids))
    rows = (
        client.table("older_adult_profiles")
        .select("id")
        .eq("family_id", family_id)
        .in_("id", unique_ids)
        .execute()
        .data
        or []
    )
    found = {int(row["id"]) for row in rows}
    missing = [item for item in unique_ids if item not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"These older adults are not in this family: {missing}",
        )


def _replace_relationships(
    client: Client, family_member_id: int, relationships: list[Any]
) -> None:
    client.table("family_member_older_adults").delete().eq(
        "family_member_id", family_member_id
    ).execute()
    client.table("family_member_older_adults").insert([
        {
            "family_member_id": family_member_id,
            "older_adult_id": item.older_adult_id,
            "relationship": item.relationship,
        }
        for item in relationships
    ]).execute()


def _load_family_member(client: Client, family_member_id: int) -> dict[str, Any]:
    rows = (
        client.table("family_members")
        .select(FAMILY_MEMBER_SELECT)
        .eq("id", family_member_id)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Family member not found.")
    return _shape_family_member(rows[0])


@router.post(
    "/voice/session",
    response_model=VoiceSessionResponse,
    tags=["Voice"],
    summary="Create a browser voice session",
    description=(
        "Create a short-lived OpenAI Realtime credential for the signed-in browser. "
        "The permanent OpenAI API key is never returned."
    ),
)
def create_voice_session(
    user: Any = Depends(require_user),
) -> dict[str, Any]:
    try:
        return create_realtime_client_secret(user_id(user))
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail="Browser voice is not available.") from error
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not create browser voice session.") from error



@router.get(
    "/me",
    response_model=ViewerResponse,
    tags=["Families"],
    summary="Identify the signed-in person",
    description=(
        "Report whether the signed-in account organizes a family or is an older "
        "adult. An older adult who signs in by magic link for the first time is "
        "matched to their profile by email address and linked here."
    ),
)
def get_viewer(
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    uid = user_id(user)
    try:
        owner = (
            client.table("family_accounts")
            .select("family_id, role")
            .eq("user_id", uid)
            .in_("role", ["owner", "caregiver"])
            .limit(1)
            .execute()
            .data
        )
        if owner:
            return {"role": "organizer", "family_id": owner[0]["family_id"]}

        linked = (
            client.table("older_adult_profiles")
            .select("id, family_id, name, preferred_name")
            .eq("user_id", uid)
            .limit(1)
            .execute()
            .data
        )
        if not linked:
            # First magic-link sign-in: claim the profile holding this address.
            email = (getattr(user, "email", None) or "").strip().lower()
            if not email:
                return {"role": "unknown"}
            match = (
                client.table("older_adult_profiles")
                .select("id, family_id, name, preferred_name, user_id")
                .ilike("email", email)
                .limit(1)
                .execute()
                .data
            )
            if not match or match[0].get("user_id"):
                return {"role": "unknown"}
            client.table("older_adult_profiles").update({"user_id": uid}).eq(
                "id", match[0]["id"]
            ).execute()
            client.table("family_accounts").upsert(
                {"family_id": match[0]["family_id"], "user_id": uid, "role": "older_adult"},
                on_conflict="family_id,user_id",
            ).execute()
            linked = match

        profile = linked[0]
        return {
            "role": "older_adult",
            "family_id": profile["family_id"],
            "older_adult_id": profile["id"],
            "display_name": profile.get("preferred_name") or profile["name"],
        }
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not identify the signed-in person.") from error


@router.post("/families", status_code=status.HTTP_201_CREATED, response_model=FamilyResponse, tags=["Families"], summary="Create a family")
def create_family(
    payload: FamilyCreate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    try:
        owner_email = str(payload.owner_email).strip().lower() if payload.owner_email else None
        family = (
            client.table("families")
            .insert({"name": payload.name, "created_by": user_id(user), "owner_email": owner_email})
            .execute()
            .data[0]
        )
        client.table("family_accounts").insert({
            "family_id": family["id"],
            "user_id": user_id(user),
            "role": "owner",
        }).execute()
        return family
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not create family.") from error


@router.get("/families", response_model=FamilyListResponse, tags=["Families"], summary="List my families")
def list_families(
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    try:
        accounts = (
            client.table("family_accounts")
            .select("families(*)")
            .eq("user_id", user_id(user))
            .execute()
            .data
        )
        return {"families": [item["families"] for item in accounts if item.get("families")]}
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load families.") from error


@router.get("/families/{family_id}", response_model=FamilyResponse, tags=["Families"], summary="Get a family")
def get_family(
    family_id: int,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_family_account(client, family_id, user)
    try:
        result = client.table("families").select("*").eq("id", family_id).limit(1).execute().data
        if not result:
            raise HTTPException(status_code=404, detail="Family not found.")
        return result[0]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load family.") from error


@router.patch("/families/{family_id}", response_model=FamilyResponse, tags=["Families"], summary="Update a family")
def update_family(
    family_id: int,
    payload: FamilyUpdate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_family_account(client, family_id, user)
    try:
        result = client.table("families").update(payload.model_dump()).eq("id", family_id).execute().data
        if not result:
            raise HTTPException(status_code=404, detail="Family not found.")
        return result[0]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not update family.") from error


@router.post("/older-adults", status_code=status.HTTP_201_CREATED, response_model=OlderAdultResponse, tags=["Older adults"], summary="Create an older-adult profile")
def create_older_adult(
    payload: OlderAdultCreate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_family_account(client, payload.family_id, user)
    values = payload.model_dump(exclude_none=True)
    values["created_by"] = user_id(user)
    try:
        return client.table("older_adult_profiles").insert(values).execute().data[0]
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not create older-adult profile.") from error


@router.get("/families/{family_id}/older-adults", response_model=OlderAdultListResponse, tags=["Older adults"], summary="List family older-adult profiles")
def list_older_adults(
    family_id: int,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_family_account(client, family_id, user)
    try:
        result = client.table("older_adult_profiles").select("*").eq("family_id", family_id).execute()
        return {"older_adults": result.data or []}
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load older-adult profiles.") from error


@router.get("/older-adults/{older_adult_id}", response_model=OlderAdultResponse, tags=["Older adults"], summary="Get an older-adult profile")
def get_older_adult(
    older_adult_id: int,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_older_adult_access(client, older_adult_id, user)
    try:
        result = client.table("older_adult_profiles").select("*").eq("id", older_adult_id).limit(1).execute().data
        if not result:
            raise HTTPException(status_code=404, detail="Older-adult profile not found.")
        return result[0]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load older-adult profile.") from error


@router.patch("/older-adults/{older_adult_id}", response_model=OlderAdultResponse, tags=["Older adults"], summary="Update an older-adult profile")
def update_older_adult(
    older_adult_id: int,
    payload: OlderAdultUpdate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_older_adult_access(client, older_adult_id, user)
    values = payload.model_dump(exclude_unset=True, mode="json")
    if not values:
        raise HTTPException(status_code=422, detail="At least one field is required.")
    try:
        result = client.table("older_adult_profiles").update(values).eq("id", older_adult_id).execute().data
        if not result:
            raise HTTPException(status_code=404, detail="Older-adult profile not found.")
        return result[0]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not update older-adult profile.") from error


@router.get(
    "/families/{family_id}/family-members",
    response_model=FamilyMemberListResponse,
    tags=["Family members"],
    summary="List family members",
)
def list_family_members(
    family_id: int,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_family_account(client, family_id, user)
    try:
        result = (
            client.table("family_members")
            .select(FAMILY_MEMBER_SELECT)
            .eq("family_id", family_id)
            .order("created_at")
            .execute()
        )
        return {"family_members": [_shape_family_member(row) for row in result.data or []]}
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load family members.") from error


@router.post(
    "/family-members",
    status_code=status.HTTP_201_CREATED,
    response_model=FamilyMemberResponse,
    tags=["Family members"],
    summary="Add a family member",
    description=(
        "Add one person the family can ask for support. Each relationship names how "
        "this person is related to one older adult, so the same person can be a "
        "daughter to one older adult and a sister to another."
    ),
)
def create_family_member(
    payload: FamilyMemberCreate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_family_account(client, payload.family_id, user)
    _validate_older_adults_in_family(
        client, payload.family_id, [item.older_adult_id for item in payload.relationships]
    )
    email = str(payload.email).strip().lower()
    try:
        duplicate = (
            client.table("family_members")
            .select("id")
            .eq("family_id", payload.family_id)
            .ilike("email", email)
            .limit(1)
            .execute()
            .data
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email address is already a family member.",
            )
        created = (
            client.table("family_members")
            .insert({"family_id": payload.family_id, "name": payload.name, "email": email})
            .execute()
            .data[0]
        )
        _replace_relationships(client, created["id"], payload.relationships)
        # No invitation is sent here. A family member only ever hears from
        # PeiPal when there is an actual request to answer.
        return _load_family_member(client, created["id"])
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not add family member.") from error


@router.patch(
    "/family-members/{family_member_id}",
    response_model=FamilyMemberResponse,
    tags=["Family members"],
    summary="Update a family member",
)
def update_family_member(
    family_member_id: int,
    payload: FamilyMemberUpdate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    values = payload.model_dump(exclude_unset=True, mode="json")
    if not values:
        raise HTTPException(status_code=422, detail="At least one field is required.")
    family_id = require_family_member_access(client, family_member_id, user)
    try:
        if payload.relationships is not None:
            _validate_older_adults_in_family(
                client, family_id, [item.older_adult_id for item in payload.relationships]
            )
        columns = {key: values[key] for key in ("name", "email") if key in values}
        if "email" in columns:
            columns["email"] = str(columns["email"]).strip().lower()
            duplicate = (
                client.table("family_members")
                .select("id")
                .eq("family_id", family_id)
                .ilike("email", columns["email"])
                .neq("id", family_member_id)
                .limit(1)
                .execute()
                .data
            )
            if duplicate:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This email address is already a family member.",
                )
        if columns:
            client.table("family_members").update(columns).eq("id", family_member_id).execute()
        if payload.relationships is not None:
            _replace_relationships(client, family_member_id, payload.relationships)
        return _load_family_member(client, family_member_id)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not update family member.") from error


@router.delete(
    "/family-members/{family_member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Family members"],
    summary="Remove a family member",
)
def delete_family_member(
    family_member_id: int,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> None:
    require_family_member_access(client, family_member_id, user)
    try:
        client.table("family_members").delete().eq("id", family_member_id).execute()
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not remove family member.") from error



# --- Coordination ------------------------------------------------------------------
# One plan, three shared tasks, and a reusable link for every family member.

COORDINATION_COOKIE = "peipal_coordination"


def _plan_context(client: Client, plan_id: int) -> dict[str, Any]:
    plan = (
        client.table("plans")
        .select("id, family_id, older_adult_id, activity_id, status")
        .eq("id", plan_id)
        .limit(1)
        .execute()
        .data
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")
    profile = (
        client.table("older_adult_profiles")
        .select("name, preferred_name")
        .eq("id", plan[0]["older_adult_id"])
        .limit(1)
        .execute()
        .data[0]
    )
    activity = (
        client.table("activities")
        .select("name, location, start_at, end_at, info_link")
        .eq("id", plan[0]["activity_id"])
        .limit(1)
        .execute()
        .data[0]
    )
    return {
        "plan": plan[0],
        "person_name": profile.get("preferred_name") or profile["name"],
        "activity": activity,
    }


def _member_names(client: Client, family_id: int) -> dict[int, str]:
    rows = (
        client.table("family_members").select("id, name").eq("family_id", family_id).execute().data
        or []
    )
    return {int(row["id"]): row["name"] for row in rows}


def _shape_state(
    client: Client, context: dict[str, Any], responding_as: str | None = None
) -> dict[str, Any]:
    plan = context["plan"]
    state = load_state(client, plan["id"])
    names = _member_names(client, plan["family_id"])
    return {
        "plan_id": plan["id"],
        "plan_status": plan["status"],
        "older_adult": context["person_name"],
        "activity": context["activity"],
        "tasks": [
            {
                "task_type": task["task_type"],
                "status": task["status"],
                "owner_name": names.get(task.get("owner_family_member_id")),
                "decided_by_name": names.get(task.get("decided_by_family_member_id")),
                "reason": task.get("reason"),
                "version": task["version"],
            }
            for task in state["tasks"]
        ],
        "events": state["events"],
        "responding_as": responding_as,
    }


@router.post(
    "/plans/{plan_id}/coordination",
    response_model=CoordinationLaunchResponse,
    tags=["Coordination"],
    summary="Ask the family",
    description=(
        "Create the approval, registration, and transport tasks and email every "
        "family member their own link. Safe to call again: a family member who "
        "was already emailed successfully is never emailed twice."
    ),
)
def launch_coordination(
    plan_id: int,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_plan_access(client, plan_id, user)
    context = _plan_context(client, plan_id)
    plan = context["plan"]
    if plan["status"] not in {"draft", "coordinating"}:
        raise HTTPException(status_code=409, detail="This plan is no longer waiting on the family.")
    try:
        ensure_coordination(client, plan_id)
        if plan["status"] == "draft":
            client.table("plans").update({"status": "coordinating"}).eq("id", plan_id).execute()
            plan["status"] = "coordinating"

        # The link outlives the activity by a week so latecomers can still read it.
        deliveries = send_coordination_emails(
            client,
            plan_id=plan_id,
            family_id=plan["family_id"],
            person_name=context["person_name"],
            activity=context["activity"],
            expires_at=expires_in(7 * 24 * 60),
        )
        failed = [item for item in deliveries if item["status"] == "failed"]
        if not deliveries:
            message = "There is nobody in your family to ask yet."
        elif not failed:
            message = "Your whole family has been asked."
        elif len(failed) == len(deliveries):
            message = "Nobody could be emailed. You can try again once email is working."
        else:
            message = (
                f"{len(deliveries) - len(failed)} of {len(deliveries)} family members were "
                f"emailed; {len(failed)} could not be reached and can be retried."
            )
        return {
            "plan_id": plan_id,
            "plan_status": plan["status"],
            "deliveries": deliveries,
            "message": message,
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not ask the family.") from error


@router.get(
    "/plans/{plan_id}/coordination",
    response_model=CoordinationStateResponse,
    tags=["Coordination"],
    summary="Read coordination progress",
)
def get_coordination(
    plan_id: int,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_plan_access(client, plan_id, user)
    return _shape_state(client, _plan_context(client, plan_id))


@router.post(
    "/plans/{plan_id}/complete",
    response_model=PlanResponse,
    tags=["Coordination"],
    summary="Mark a ready plan as done",
)
def complete_plan(
    plan_id: int,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_plan_access(client, plan_id, user)
    updated = (
        client.table("plans")
        .update({"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", plan_id)
        .eq("status", "ready")
        .execute()
        .data
    )
    if not updated:
        raise HTTPException(status_code=409, detail="Only a ready plan can be marked as done.")
    return updated[0]


def _link_for_token(client: Client, token: str) -> dict[str, Any]:
    rows = (
        client.table("plan_coordination_links")
        .select("plan_id, family_member_id, expires_at, revoked_at")
        .eq("token_hash", digest(token))
        .limit(1)
        .execute()
        .data
    )
    if not rows or rows[0].get("revoked_at"):
        raise HTTPException(status_code=404, detail="This link is not valid.")
    link = rows[0]
    if datetime.fromisoformat(link["expires_at"].replace("Z", "+00:00")) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This link has expired.")
    member = (
        client.table("family_members")
        .select("name")
        .eq("id", link["family_member_id"])
        .limit(1)
        .execute()
        .data
    )
    if not member:
        raise HTTPException(status_code=404, detail="This link is not valid.")
    link["member_name"] = member[0]["name"]
    return link


@router.get(
    "/coordination/{token}",
    response_model=CoordinationStateResponse,
    tags=["Coordination"],
    summary="Open a family coordination link",
    description=(
        "Public on purpose. Family members hold no account, so possession of the "
        "emailed token is what identifies them. Never returns email addresses, "
        "phone numbers, or anything about the wider family."
    ),
)
def read_coordination(
    token: str,
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    link = _link_for_token(client, token)
    context = _plan_context(client, link["plan_id"])
    ensure_coordination(client, link["plan_id"])
    return _shape_state(client, context, responding_as=link["member_name"])


@router.post(
    "/coordination/{token}/tasks/{task_type}",
    response_model=CoordinationStateResponse,
    tags=["Coordination"],
    summary="Approve, reject, or help with a task",
    description=(
        "Every change carries the version the page was showing. A change that "
        "lost a race returns 409 so the page can refresh rather than overwrite "
        "somebody else's action."
    ),
)
def act_on_coordination_task(
    token: str,
    task_type: str,
    payload: CoordinationActionRequest,
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    link = _link_for_token(client, token)
    context = _plan_context(client, link["plan_id"])
    plan = context["plan"]
    if plan["status"] not in {"draft", "coordinating"}:
        raise HTTPException(
            status_code=409,
            detail="This plan is already settled, so it cannot be changed.",
        )
    coordination = ensure_coordination(client, plan["id"])
    apply_action(
        client,
        plan_id=plan["id"],
        coordination_id=coordination["id"],
        task_type=task_type,
        action=payload.action,
        expected_version=payload.expected_version,
        actor_id=link["family_member_id"],
        actor_name=link["member_name"],
        reason=payload.reason,
    )
    refreshed = _plan_context(client, plan["id"])
    return _shape_state(client, refreshed, responding_as=link["member_name"])


@router.post("/plans", status_code=status.HTTP_201_CREATED, response_model=PlanResponse, tags=["Plans"], summary="Create a plan")
def create_plan(
    payload: PlanCreate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_family_account(client, payload.family_id, user)
    older_adult_family_id = family_id_for_older_adult(client, payload.older_adult_id)
    if older_adult_family_id != payload.family_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The older-adult profile does not belong to this family.",
        )
    try:
        activity = (
            client.table("activities")
            .select("id")
            .eq("id", payload.activity_id)
            .eq("status", "active")
            .gte("start_at", datetime.now(timezone.utc).isoformat())
            .limit(1)
            .execute()
            .data
        )
        if not activity:
            raise HTTPException(status_code=404, detail="Active activity not found.")
        values = payload.model_dump()
        values["created_by"] = user_id(user)
        plan = client.table("plans").insert(values).execute().data[0]

        # Choosing an activity is the ask. The family is emailed straight away,
        # so the older adult confirms once rather than twice. If nothing could
        # be sent the plan stays a draft, and the plan page offers a retry.
        try:
            context = _plan_context(client, plan["id"])
            ensure_coordination(client, plan["id"])
            deliveries = send_coordination_emails(
                client,
                plan_id=plan["id"],
                family_id=plan["family_id"],
                person_name=context["person_name"],
                activity=context["activity"],
                expires_at=expires_in(7 * 24 * 60),
            )
        except Exception:
            deliveries = []
        if any(item["status"] != "failed" for item in deliveries):
            plan = (
                client.table("plans")
                .update({"status": "coordinating"})
                .eq("id", plan["id"])
                .execute()
                .data[0]
            )
        return plan
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not create plan.") from error


@router.get("/plans", response_model=PlanListResponse, tags=["Plans"], summary="List family plans")
def list_plans(
    family_id: int,
    status_filter: str | None = Query(default=None, alias="status"),
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_family_account(client, family_id, user)
    query = client.table("plans").select("*").eq("family_id", family_id).order("created_at", desc=True)
    if status_filter:
        query = query.eq("status", status_filter)
    try:
        return {"plans": query.execute().data or []}
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load plans.") from error


@router.get("/plans/{plan_id}", response_model=PlanResponse, tags=["Plans"], summary="Get a plan")
def get_plan(
    plan_id: int,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_plan_access(client, plan_id, user)
    try:
        result = client.table("plans").select("*").eq("id", plan_id).limit(1).execute().data
        if not result:
            raise HTTPException(status_code=404, detail="Plan not found.")
        return result[0]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load plan.") from error


@router.patch(
    "/plans/{plan_id}",
    response_model=PlanResponse,
    tags=["Plans"],
    summary="Update a plan status",
    description=(
        "Use this resource update for the plan lifecycle. Valid transitions are "
        "draft → awaiting_approval → shared for family approval, or cancellation "
        "from any active state. Direct-sharing profiles create plans as shared. "
        "Sharing requires the family owner."
    ),
)
def update_plan(
    plan_id: int,
    payload: PlanUpdate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    family_id = require_plan_access(client, plan_id, user)
    try:
        plan = client.table("plans").select("status").eq("id", plan_id).limit(1).execute().data[0]
        current_status = plan["status"]
        next_status = payload.status
        valid_transitions = {
            "draft": {"cancelled"},
            "coordinating": {"cancelled"},
            "ready": {"cancelled"},
            "completed": set(),
            "rejected": set(),
            "cancelled": set(),
        }
        if next_status not in valid_transitions[current_status]:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot change a plan from {current_status} to {next_status}.",
            )

        values: dict[str, Any] = {
            "status": next_status,
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
        }

        return client.table("plans").update(values).eq("id", plan_id).execute().data[0]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not update plan.") from error


@router.get("/activities", response_model=ActivityListResponse, tags=["Activities"], summary="List active activities")
def list_activities(
    location: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=3, ge=1, le=20),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    query = (
        client.table("activities")
        .select("*")
        .eq("status", "active")
        .gte("start_at", datetime.now(timezone.utc).isoformat())
        .order("start_at", desc=False)
        .limit(limit)
    )
    if location:
        query = query.ilike("location", f"%{location}%")
    try:
        return {"activities": query.execute().data}
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load activities.") from error


@router.get(
    "/older-adults/{older_adult_id}/recommendations",
    response_model=ActivityRecommendationListResponse,
    tags=["Activities"],
    summary="Recommend activities for an older adult",
)
def list_activity_recommendations(
    older_adult_id: int,
    location: str | None = Query(default=None, max_length=120),
    interest: str | None = Query(default=None, max_length=240),
    max_cost: float | None = Query(default=None, ge=0),
    mobility: str | None = Query(default=None, max_length=240),
    activity_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=20, ge=1, le=20),
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_older_adult_access(client, older_adult_id, user)
    try:
        recommendations = recommend_activities(
            client,
            older_adult_id,
            interest=interest,
            max_cost=max_cost,
            location=location,
            mobility=mobility,
            activity_id=activity_id,
            limit=limit,
        )
        return {"recommendations": recommendations}
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not calculate activity recommendations.") from error


@router.get(
    "/activities/{activity_id}",
    response_model=ActivityResponse,
    tags=["Activities"],
    summary="Get an activity",
    description="Load an activity referenced by an existing plan, including an expired activity.",
)
def get_activity(
    activity_id: int,
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    try:
        result = client.table("activities").select("*").eq("id", activity_id).limit(1).execute().data
        if not result:
            raise HTTPException(status_code=404, detail="Activity not found.")
        return result[0]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load activity.") from error
