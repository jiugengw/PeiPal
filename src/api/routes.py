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
    FamilyResponse,
    FamilyUpdate,
    NotificationDeliveryListResponse,
    OlderAdultCreate,
    OlderAdultListResponse,
    OlderAdultResponse,
    OlderAdultUpdate,
    PlanCreate,
    PlanListResponse,
    PlanNotificationCreate,
    PlanNotificationListResponse,
    PlanResponse,
    PlanUpdate,
    SupportOfferCreate,
    SupportOfferListResponse,
    SupportOfferResponse,
    VoiceSessionResponse,
)
from src.services.notifications import send_plan_email
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


@router.post("/families", status_code=status.HTTP_201_CREATED, response_model=FamilyResponse, tags=["Families"], summary="Create a family")
def create_family(
    payload: FamilyCreate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    try:
        family = (
            client.table("families")
            .insert({"name": payload.name, "created_by": user_id(user)})
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
        profile = (
            client.table("older_adult_profiles")
            .select("sharing_mode")
            .eq("id", payload.older_adult_id)
            .limit(1)
            .execute()
            .data
        )
        sharing_mode = profile[0]["sharing_mode"] if profile else "family_approval"
        values = payload.model_dump()
        values["created_by"] = user_id(user)
        if sharing_mode == "direct":
            values.update({
                "status": "shared",
                "shared_at": datetime.now(timezone.utc).isoformat(),
            })
        return client.table("plans").insert(values).execute().data[0]
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
            "draft": {"awaiting_approval", "cancelled"},
            "awaiting_approval": {"shared", "cancelled"},
            "shared": {"cancelled"},
            "cancelled": set(),
        }
        if next_status not in valid_transitions[current_status]:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot change a plan from {current_status} to {next_status}.",
            )

        values: dict[str, Any] = {"status": next_status}
        now = datetime.now(timezone.utc).isoformat()
        if next_status == "shared":
            require_family_owner(client, family_id, user)
            values.update({"approved_by": user_id(user), "approved_at": now, "shared_at": now})
        elif next_status == "cancelled":
            values["cancelled_at"] = now

        result = client.table("plans").update(values).eq("id", plan_id).execute().data
        return result[0]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not update plan.") from error


@router.post(
    "/plans/{plan_id}/support-offers",
    status_code=status.HTTP_201_CREATED,
    response_model=SupportOfferResponse,
    tags=["Support offers"],
    summary="Offer support for a shared plan",
)
def create_support_offer(
    plan_id: int,
    payload: SupportOfferCreate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_plan_access(client, plan_id, user)
    try:
        plan = client.table("plans").select("status").eq("id", plan_id).limit(1).execute().data[0]
        if plan["status"] != "shared":
            raise HTTPException(status_code=409, detail="Support can only be offered on a shared plan.")
        existing = (
            client.table("plan_support_offers")
            .select("id, status")
            .eq("plan_id", plan_id)
            .eq("offered_by", user_id(user))
            .eq("support_type", payload.support_type)
            .limit(1)
            .execute()
            .data
        )
        if existing and existing[0]["status"] == "offered":
            raise HTTPException(status_code=409, detail="You already offered this type of support.")
        values = payload.model_dump()
        values.update({"plan_id": plan_id, "offered_by": user_id(user)})
        if existing:
            values.update({"status": "offered", "updated_at": datetime.now(timezone.utc).isoformat()})
            return client.table("plan_support_offers").update(values).eq("id", existing[0]["id"]).execute().data[0]
        return client.table("plan_support_offers").insert(values).execute().data[0]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not create support offer.") from error


@router.get(
    "/plans/{plan_id}/support-offers",
    response_model=SupportOfferListResponse,
    tags=["Support offers"],
    summary="List support offers",
)
def list_support_offers(
    plan_id: int,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_plan_access(client, plan_id, user)
    try:
        result = (
            client.table("plan_support_offers")
            .select("*")
            .eq("plan_id", plan_id)
            .eq("status", "offered")
            .order("created_at")
            .execute()
        )
        return {"support_offers": result.data or []}
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load support offers.") from error


@router.delete("/support-offers/{offer_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Support offers"], summary="Withdraw a support offer")
def withdraw_support_offer(
    offer_id: int,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> None:
    try:
        offer = client.table("plan_support_offers").select("plan_id, offered_by").eq("id", offer_id).limit(1).execute().data
        if not offer:
            raise HTTPException(status_code=404, detail="Support offer not found.")
        require_plan_access(client, offer[0]["plan_id"], user)
        if offer[0]["offered_by"] != user_id(user):
            raise HTTPException(status_code=403, detail="You can only withdraw your own support offer.")
        client.table("plan_support_offers").update({"status": "withdrawn"}).eq("id", offer_id).execute()
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not withdraw support offer.") from error


@router.post(
    "/plans/{plan_id}/notifications",
    response_model=NotificationDeliveryListResponse,
    tags=["Notifications"],
    summary="Send plan notifications",
    description=(
        "Send one email to each selected family member for a shared plan. "
        "Successful recipients are not sent again if this request is retried; "
        "failed recipients can be retried."
    ),
)
def send_plan_notifications(
    plan_id: int,
    payload: PlanNotificationCreate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    family_id = require_plan_access(client, plan_id, user)
    selected_member_ids = list(dict.fromkeys(payload.family_member_ids))
    try:
        plan_rows = (
            client.table("plans")
            .select("status, older_adult_id, activity_id")
            .eq("id", plan_id)
            .limit(1)
            .execute()
            .data
        )
        if not plan_rows:
            raise HTTPException(status_code=404, detail="Plan not found.")
        plan = plan_rows[0]
        if plan["status"] != "shared":
            raise HTTPException(status_code=409, detail="Only shared plans can send notifications.")

        members = (
            client.table("family_members")
            .select("id, name, email")
            .eq("family_id", family_id)
            .in_("id", selected_member_ids)
            .execute()
            .data
            or []
        )
        members_by_id = {int(member["id"]): member for member in members}
        missing_ids = [member_id for member_id in selected_member_ids if member_id not in members_by_id]
        if missing_ids:
            raise HTTPException(status_code=404, detail=f"Family members not found: {missing_ids}")

        profile = (
            client.table("older_adult_profiles")
            .select("name, preferred_name")
            .eq("id", plan["older_adult_id"])
            .limit(1)
            .execute()
            .data[0]
        )
        activity = (
            client.table("activities")
            .select("name, location, start_at, info_link")
            .eq("id", plan["activity_id"])
            .limit(1)
            .execute()
            .data[0]
        )
        person_name = profile.get("preferred_name") or profile["name"]
        subject = f"{person_name} is interested in an activity"
        body = (
            f"{person_name} is interested in {activity['name']} at {activity['location']} "
            f"on {activity['start_at']}.\n\n"
            "Would you like to join, help with transport, remind them, or offer another kind of support? "
            "There is no obligation.\n\n"
            f"More information: {activity['info_link']}"
        )

        deliveries: list[dict[str, Any]] = []
        for member_id in selected_member_ids:
            member = members_by_id[member_id]
            existing = (
                client.table("plan_notifications")
                .select("id, status")
                .eq("plan_id", plan_id)
                .eq("family_member_id", member_id)
                .limit(1)
                .execute()
                .data
                or []
            )
            if existing and existing[0]["status"] == "sent":
                deliveries.append({"family_member_id": member_id, "name": member["name"], "status": "already_sent"})
                continue

            if existing:
                notification_id = existing[0]["id"]
                client.table("plan_notifications").update({
                    "status": "pending",
                    "recipient_name": member["name"],
                    "recipient_email": member.get("email"),
                    "error_message": None,
                    "attempted_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", notification_id).execute()
            else:
                notification_id = (
                    client.table("plan_notifications")
                    .insert({
                        "plan_id": plan_id,
                        "family_member_id": member_id,
                        "recipient_name": member["name"],
                        "recipient_email": member.get("email"),
                        "status": "pending",
                        "attempted_at": datetime.now(timezone.utc).isoformat(),
                    })
                    .execute()
                    .data[0]["id"]
                )

            if not member.get("email"):
                error_message = "This family member has no email address."
                client.table("plan_notifications").update({
                    "status": "failed",
                    "error_message": error_message,
                }).eq("id", notification_id).execute()
                deliveries.append({"family_member_id": member_id, "name": member["name"], "status": "failed", "error": error_message})
                continue

            try:
                provider_id = send_plan_email(
                    recipient_email=member["email"],
                    subject=subject,
                    body=body,
                    idempotency_key=f"plan-notification/{plan_id}/{member_id}",
                )
            except Exception:
                error_message = "Email delivery failed."
                client.table("plan_notifications").update({
                    "status": "failed",
                    "error_message": error_message,
                }).eq("id", notification_id).execute()
                deliveries.append({"family_member_id": member_id, "name": member["name"], "status": "failed", "error": error_message})
            else:
                client.table("plan_notifications").update({
                    "status": "sent",
                    "provider_id": provider_id,
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                    "error_message": None,
                }).eq("id", notification_id).execute()
                deliveries.append({"family_member_id": member_id, "name": member["name"], "status": "sent", "provider_id": provider_id})

        return {"deliveries": deliveries}
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not send plan notifications.") from error


@router.get(
    "/plans/{plan_id}/notifications",
    response_model=PlanNotificationListResponse,
    tags=["Notifications"],
    summary="List plan notifications",
)
def list_plan_notifications(
    plan_id: int,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_plan_access(client, plan_id, user)
    try:
        result = (
            client.table("plan_notifications")
            .select("*")
            .eq("plan_id", plan_id)
            .order("created_at")
            .execute()
        )
        return {"notifications": result.data or []}
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load plan notifications.") from error


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
