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
