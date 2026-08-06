"""FastAPI dependencies for Supabase access and user authentication."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from fastapi import Depends, Header, HTTPException, status
from supabase import Client, create_client

from src.api.config import supabase_service_key, supabase_url


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


def require_household_member(client: Client, household_id: int, user: Any) -> None:
    result = (
        client.table("household_members")
        .select("household_id")
        .eq("household_id", household_id)
        .eq("user_id", user_id(user))
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this household.",
        )


def household_id_for_older_adult(client: Client, older_adult_id: int) -> int:
    result = (
        client.table("older_adult_profiles")
        .select("household_id")
        .eq("id", older_adult_id)
        .limit(1)
        .execute()
        .data
    )
    if not result:
        raise HTTPException(status_code=404, detail="Older-adult profile not found.")
    return int(result[0]["household_id"])


def require_older_adult_access(
    client: Client, older_adult_id: int, user: Any
) -> int:
    household_id = household_id_for_older_adult(client, older_adult_id)
    require_household_member(client, household_id, user)
    return household_id
