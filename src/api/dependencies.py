"""FastAPI dependencies for Supabase access and user authentication."""

from __future__ import annotations

from functools import lru_cache
from types import SimpleNamespace
from typing import Any

from fastapi import Depends, Header, HTTPException, status
from supabase import Client, create_client

from src.api.config import supabase_service_key, supabase_url
from src.services.workbuddy_tokens import resolve_token


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
    # A WorkBuddy/ChatGPT-style client presents its own personal access
    # token here instead of a Supabase JWT; resolve it directly to a user,
    # no Supabase call needed. Falls through to a normal browser session.
    workbuddy_user_id = resolve_token(client, token)
    if workbuddy_user_id is not None:
        return SimpleNamespace(id=workbuddy_user_id)

    try:
        response = client.auth.get_user(token)
        user = response.user
    except Exception as error:  # Provider-specific SDK errors vary by version.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The Supabase session is invalid or expired.",
        ) from error

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The Supabase session is invalid or expired.",
        )
    return user


def user_id(user: Any) -> str:
    return str(user.id)


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
