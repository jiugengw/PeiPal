"""FastAPI dependencies for Supabase access and user authentication."""

from __future__ import annotations

import logging
from functools import lru_cache
from types import SimpleNamespace
from typing import Any

from fastapi import Depends, Header, HTTPException, status
from supabase import Client, create_client

from src.api.config import supabase_service_key, supabase_url
from src.services.oauth import resolve_access_token

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    return create_client(supabase_url(), supabase_service_key())


def require_user(
    authorization: str | None = Header(default=None),
    client: Client = Depends(get_supabase_client),
) -> Any:
    """Validate a Supabase access token and return its user object."""

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A Supabase bearer token is required.",
        )

    token = authorization.removeprefix("Bearer ").strip()
    oauth_identity = resolve_access_token(client, token)
    if oauth_identity is not None:
        oauth_user_id, scopes = oauth_identity
        return SimpleNamespace(id=oauth_user_id, oauth_scopes=scopes)

    try:
        response = client.auth.get_user(token)
        user = response.user
    except Exception as error:  # Provider-specific SDK errors vary by version.
        logger.warning("Supabase get_user rejected bearer token: %s", error)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The Supabase session is invalid or expired.",
        ) from error

    if user is None:
        logger.warning("Supabase get_user returned no user for the given bearer token.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The Supabase session is invalid or expired.",
        )
    return user


def user_id(user: Any) -> str:
    return str(user.id)


def require_scope(user: Any, scope: str) -> None:
    scopes = getattr(user, "oauth_scopes", None)
    if scopes is not None and scope not in scopes:
        raise HTTPException(status_code=403, detail=f"This connection needs the {scope} permission.")


def require_family_account(client: Client, family_id: int, user: Any) -> None:
    result = (
        client.table("family_accounts")
        .select("family_id")
        .eq("family_id", family_id)
        .eq("user_id", user_id(user))
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this family.",
        )


def older_adult_profile_for_user(client: Client, user: Any) -> dict[str, Any] | None:
    rows = (
        client.table("older_adult_profiles")
        .select("id, family_id, name, preferred_name, user_id")
        .eq("user_id", user_id(user))
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


def ensure_older_adult_membership(client: Client, profile: dict[str, Any], user: Any) -> None:
    client.table("family_accounts").upsert(
        {"family_id": profile["family_id"], "user_id": user_id(user), "role": "older_adult"},
        on_conflict="family_id,user_id",
    ).execute()


def require_family_read_access(
    client: Client, family_id: int, user: Any
) -> dict[str, Any] | None:
    profile = older_adult_profile_for_user(client, user)
    if profile:
        if int(profile["family_id"]) != int(family_id):
            raise HTTPException(status_code=403, detail="You are not a member of this family.")
        ensure_older_adult_membership(client, profile, user)
        return profile
    require_family_account(client, family_id, user)
    return None


def require_family_manager(client: Client, family_id: int, user: Any) -> None:
    result = (
        client.table("family_accounts")
        .select("family_id")
        .eq("family_id", family_id)
        .eq("user_id", user_id(user))
        .in_("role", ["owner", "caregiver"])
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="Only the family organizer can manage this family.")


def require_plan_read_access(client: Client, plan_id: int, user: Any) -> dict[str, Any] | None:
    rows = (
        client.table("plans")
        .select("family_id, older_adult_id")
        .eq("id", plan_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Plan not found.")
    profile = require_family_read_access(client, int(rows[0]["family_id"]), user)
    if profile and int(rows[0]["older_adult_id"]) != int(profile["id"]):
        raise HTTPException(status_code=403, detail="You are not allowed to view this plan.")
    return profile


def require_plan_create_access(
    client: Client, family_id: int, older_adult_id: int, user: Any
) -> None:
    profile = require_family_read_access(client, family_id, user)
    if profile and int(profile["id"]) != int(older_adult_id):
        raise HTTPException(status_code=403, detail="You can only create plans for your own profile.")


def family_id_for_older_adult(client: Client, older_adult_id: int) -> int:
    result = (
        client.table("older_adult_profiles")
        .select("family_id")
        .eq("id", older_adult_id)
        .limit(1)
        .execute()
        .data
    )
    if not result:
        raise HTTPException(status_code=404, detail="Older-adult profile not found.")
    return int(result[0]["family_id"])


def require_older_adult_access(
    client: Client, older_adult_id: int, user: Any
) -> int:
    family_id = family_id_for_older_adult(client, older_adult_id)
    require_family_account(client, family_id, user)
    return family_id


def family_id_for_plan(client: Client, plan_id: int) -> int:
    result = (
        client.table("plans")
        .select("family_id")
        .eq("id", plan_id)
        .limit(1)
        .execute()
        .data
    )
    if not result:
        raise HTTPException(status_code=404, detail="Plan not found.")
    return int(result[0]["family_id"])


def require_plan_access(client: Client, plan_id: int, user: Any) -> int:
    family_id = family_id_for_plan(client, plan_id)
    require_family_account(client, family_id, user)
    return family_id


def family_id_for_family_member(client: Client, family_member_id: int) -> int:
    result = (
        client.table("family_members")
        .select("family_id")
        .eq("id", family_member_id)
        .limit(1)
        .execute()
        .data
    )
    if not result:
        raise HTTPException(status_code=404, detail="Family member not found.")
    return int(result[0]["family_id"])


def require_family_member_access(client: Client, family_member_id: int, user: Any) -> int:
    family_id = family_id_for_family_member(client, family_member_id)
    require_family_account(client, family_id, user)
    return family_id


def require_family_owner(client: Client, family_id: int, user: Any) -> None:
    result = (
        client.table("family_accounts")
        .select("family_id")
        .eq("family_id", family_id)
        .eq("user_id", user_id(user))
        .eq("role", "owner")
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the family owner can approve this plan.",
        )
