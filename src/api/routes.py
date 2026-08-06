"""Website API routes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from src.api.dependencies import (
    get_supabase_client,
    household_id_for_older_adult,
    require_household_owner,
    require_household_member,
    require_older_adult_access,
    require_plan_access,
    require_user,
    user_id,
)
from src.api.models import (
    ActivityListResponse,
    HouseholdCreate,
    HouseholdResponse,
    HouseholdUpdate,
    OlderAdultCreate,
    OlderAdultResponse,
    OlderAdultUpdate,
    PlanCreate,
    PlanUpdate,
    SupportOfferCreate,
    TrustedContactCreate,
    TrustedContactResponse,
    TrustedContactUpdate,
)


router = APIRouter(prefix="/api")


@router.post("/households", status_code=status.HTTP_201_CREATED, response_model=HouseholdResponse, tags=["Households"], summary="Create a household")
def create_household(
    payload: HouseholdCreate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    try:
        household = (
            client.table("households")
            .insert({"name": payload.name, "created_by": user_id(user)})
            .execute()
            .data[0]
        )
        client.table("household_members").insert({
            "household_id": household["id"],
            "user_id": user_id(user),
            "role": "owner",
        }).execute()
        return household
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not create household.") from error


@router.get("/households", tags=["Households"], summary="List my households")
def list_households(
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    try:
        members = (
            client.table("household_members")
            .select("households(*)")
            .eq("user_id", user_id(user))
            .execute()
            .data
        )
        return {"households": [item["households"] for item in members if item.get("households")]}
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load households.") from error


@router.get("/households/{household_id}", tags=["Households"], summary="Get a household")
def get_household(
    household_id: int,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_household_member(client, household_id, user)
    try:
        result = client.table("households").select("*").eq("id", household_id).limit(1).execute().data
        if not result:
            raise HTTPException(status_code=404, detail="Household not found.")
        return result[0]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load household.") from error


@router.patch("/households/{household_id}", tags=["Households"], summary="Update a household")
def update_household(
    household_id: int,
    payload: HouseholdUpdate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_household_member(client, household_id, user)
    try:
        result = client.table("households").update(payload.model_dump()).eq("id", household_id).execute().data
        if not result:
            raise HTTPException(status_code=404, detail="Household not found.")
        return result[0]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not update household.") from error


@router.post("/older-adults", status_code=status.HTTP_201_CREATED, response_model=OlderAdultResponse, tags=["Older adults"], summary="Create an older-adult profile")
def create_older_adult(
    payload: OlderAdultCreate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_household_member(client, payload.household_id, user)
    values = payload.model_dump(exclude_none=True)
    values["created_by"] = user_id(user)
    try:
        return client.table("older_adult_profiles").insert(values).execute().data[0]
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not create older-adult profile.") from error


@router.get("/households/{household_id}/older-adults", tags=["Older adults"], summary="List household older-adult profiles")
def list_older_adults(
    household_id: int,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_household_member(client, household_id, user)
    try:
        result = client.table("older_adult_profiles").select("*").eq("household_id", household_id).execute()
        return {"older_adults": result.data or []}
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load older-adult profiles.") from error


@router.get("/older-adults/{older_adult_id}", tags=["Older adults"], summary="Get an older-adult profile")
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


@router.patch("/older-adults/{older_adult_id}", tags=["Older adults"], summary="Update an older-adult profile")
def update_older_adult(
    older_adult_id: int,
    payload: OlderAdultUpdate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_older_adult_access(client, older_adult_id, user)
    values = payload.model_dump(exclude_unset=True)
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


@router.get("/older-adults/{older_adult_id}/trusted-contacts", tags=["Trusted contacts"], summary="List trusted contacts")
def list_trusted_contacts(
    older_adult_id: int,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_older_adult_access(client, older_adult_id, user)
    try:
        result = client.table("trusted_contacts").select("*").eq("older_adult_id", older_adult_id).execute()
        return {"trusted_contacts": result.data or []}
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load trusted contacts.") from error


@router.post("/trusted-contacts", status_code=status.HTTP_201_CREATED, response_model=TrustedContactResponse, tags=["Trusted contacts"], summary="Add a trusted contact")
def create_trusted_contact(
    payload: TrustedContactCreate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    try:
        profile = (
            client.table("older_adult_profiles")
            .select("household_id")
            .eq("id", payload.older_adult_id)
            .limit(1)
            .execute()
            .data
        )
        if not profile:
            raise HTTPException(status_code=404, detail="Older-adult profile not found.")
        require_household_member(client, profile[0]["household_id"], user)
        return client.table("trusted_contacts").insert(
            payload.model_dump(exclude_none=True)
        ).execute().data[0]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not create trusted contact.") from error


@router.patch("/trusted-contacts/{contact_id}", tags=["Trusted contacts"], summary="Update a trusted contact")
def update_trusted_contact(
    contact_id: int,
    payload: TrustedContactUpdate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise HTTPException(status_code=422, detail="At least one field is required.")
    try:
        result = client.table("trusted_contacts").select("older_adult_id").eq("id", contact_id).limit(1).execute().data
        if not result:
            raise HTTPException(status_code=404, detail="Trusted contact not found.")
        require_older_adult_access(client, result[0]["older_adult_id"], user)
        updated = client.table("trusted_contacts").update(values).eq("id", contact_id).execute().data
        return updated[0]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not update trusted contact.") from error


@router.delete("/trusted-contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Trusted contacts"], summary="Remove a trusted contact")
def delete_trusted_contact(
    contact_id: int,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> None:
    try:
        result = client.table("trusted_contacts").select("older_adult_id").eq("id", contact_id).limit(1).execute().data
        if not result:
            raise HTTPException(status_code=404, detail="Trusted contact not found.")
        require_older_adult_access(client, result[0]["older_adult_id"], user)
        client.table("trusted_contacts").delete().eq("id", contact_id).execute()
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not delete trusted contact.") from error


@router.post("/plans", status_code=status.HTTP_201_CREATED, tags=["Plans"], summary="Create a plan")
def create_plan(
    payload: PlanCreate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_household_member(client, payload.household_id, user)
    older_adult_household_id = household_id_for_older_adult(client, payload.older_adult_id)
    if older_adult_household_id != payload.household_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The older-adult profile does not belong to this household.",
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


@router.get("/plans", tags=["Plans"], summary="List household plans")
def list_plans(
    household_id: int,
    status_filter: str | None = Query(default=None, alias="status"),
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_household_member(client, household_id, user)
    query = client.table("plans").select("*").eq("household_id", household_id).order("created_at", desc=True)
    if status_filter:
        query = query.eq("status", status_filter)
    try:
        return {"plans": query.execute().data or []}
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load plans.") from error


@router.get("/plans/{plan_id}", tags=["Plans"], summary="Get a plan")
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
    tags=["Plans"],
    summary="Update a plan status",
    description=(
        "Use this resource update for the plan lifecycle. Valid transitions are "
        "draft → awaiting_approval → shared for family approval, or cancellation "
        "from any active state. Direct-sharing profiles create plans as shared. "
        "Sharing requires the household owner."
    ),
)
def update_plan(
    plan_id: int,
    payload: PlanUpdate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    household_id = require_plan_access(client, plan_id, user)
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
            require_household_owner(client, household_id, user)
            values.update({"approved_by": user_id(user), "approved_at": now, "shared_at": now})
        elif next_status == "cancelled":
            values["cancelled_at"] = now

        result = client.table("plans").update(values).eq("id", plan_id).execute().data
        return result[0]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not update plan.") from error


@router.post("/plans/{plan_id}/support-offers", status_code=status.HTTP_201_CREATED, tags=["Support offers"], summary="Offer support for a shared plan")
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
            .select("id")
            .eq("plan_id", plan_id)
            .eq("offered_by", user_id(user))
            .eq("support_type", payload.support_type)
            .eq("status", "offered")
            .limit(1)
            .execute()
            .data
        )
        if existing:
            raise HTTPException(status_code=409, detail="You already offered this type of support.")
        values = payload.model_dump()
        values.update({"plan_id": plan_id, "offered_by": user_id(user)})
        return client.table("plan_support_offers").insert(values).execute().data[0]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not create support offer.") from error


@router.get("/plans/{plan_id}/support-offers", tags=["Support offers"], summary="List support offers")
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
        .order("total_score", desc=True)
        .limit(limit)
    )
    if location:
        query = query.ilike("location", f"%{location}%")
    try:
        return {"activities": query.execute().data}
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not load activities.") from error
