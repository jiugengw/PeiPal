"""Website API routes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from src.api.dependencies import (
    get_supabase_client,
    household_id_for_older_adult,
    require_household_member,
    require_older_adult_access,
    require_user,
    user_id,
)
from src.api.models import (
    HouseholdCreate,
    HouseholdUpdate,
    OlderAdultCreate,
    OlderAdultUpdate,
    TrustedContactCreate,
    TrustedContactUpdate,
)


router = APIRouter(prefix="/api")


@router.post("/households", status_code=status.HTTP_201_CREATED)
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


@router.get("/households")
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


@router.get("/households/{household_id}")
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


@router.patch("/households/{household_id}")
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


@router.post("/older-adults", status_code=status.HTTP_201_CREATED)
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


@router.get("/households/{household_id}/older-adults")
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


@router.get("/older-adults/{older_adult_id}")
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


@router.patch("/older-adults/{older_adult_id}")
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


@router.get("/older-adults/{older_adult_id}/trusted-contacts")
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


@router.post("/trusted-contacts", status_code=status.HTTP_201_CREATED)
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


@router.patch("/trusted-contacts/{contact_id}")
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


@router.delete("/trusted-contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
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


@router.get("/activities")
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
