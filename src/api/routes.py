"""Website API routes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from src.api.dependencies import get_supabase_client, require_user
from src.api.models import HouseholdCreate, OlderAdultCreate, TrustedContactCreate


router = APIRouter(prefix="/api")


def _user_id(user: Any) -> str:
    return str(user.id)


def _require_household_member(client: Client, household_id: int, user: Any) -> None:
    result = (
        client.table("household_members")
        .select("household_id")
        .eq("household_id", household_id)
        .eq("user_id", _user_id(user))
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this household.",
        )


@router.post("/households", status_code=status.HTTP_201_CREATED)
def create_household(
    payload: HouseholdCreate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    try:
        household = (
            client.table("households")
            .insert({"name": payload.name, "created_by": _user_id(user)})
            .execute()
            .data[0]
        )
        client.table("household_members").insert({
            "household_id": household["id"],
            "user_id": _user_id(user),
            "role": "owner",
        }).execute()
        return household
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not create household.") from error


@router.post("/older-adults", status_code=status.HTTP_201_CREATED)
def create_older_adult(
    payload: OlderAdultCreate,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, Any]:
    _require_household_member(client, payload.household_id, user)
    values = payload.model_dump(exclude_none=True)
    values["created_by"] = _user_id(user)
    try:
        return client.table("older_adult_profiles").insert(values).execute().data[0]
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not create older-adult profile.") from error


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
        _require_household_member(client, profile[0]["household_id"], user)
        return client.table("trusted_contacts").insert(
            payload.model_dump(exclude_none=True)
        ).execute().data[0]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail="Could not create trusted contact.") from error


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
