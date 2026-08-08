"""Personal access tokens for WorkBuddy/ChatGPT-style MCP clients.

Generated once on the real PeiPal website and pasted once into the
client's own connector config, so the credential is never something an
LLM agent has to see, carry, or retype on a tool call. Maps directly to a
user_id — no Supabase session/JWT involved, so it never expires on its
own. See `src/api/dependencies.py`'s `require_user` for how it's resolved.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from supabase import Client

from src.services.family_email import digest, generate_token


def create_token(client: Client, user_id: str, name: str) -> dict[str, Any]:
    token = generate_token()
    row = (
        client.table("workbuddy_access_tokens")
        .insert({"user_id": user_id, "name": name, "token_hash": digest(token)})
        .execute()
        .data[0]
    )
    return {"id": row["id"], "name": row["name"], "token": token, "created_at": row["created_at"]}


def list_tokens(client: Client, user_id: str) -> list[dict[str, Any]]:
    return (
        client.table("workbuddy_access_tokens")
        .select("id, name, created_at, revoked_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )


def revoke_token(client: Client, user_id: str, token_id: int) -> None:
    rows = (
        client.table("workbuddy_access_tokens")
        .select("id")
        .eq("id", token_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="This access token was not found.")
    client.table("workbuddy_access_tokens").update(
        {"revoked_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", token_id).execute()


def resolve_token(client: Client, token: str) -> str | None:
    """Return the user_id behind a valid, unrevoked personal access token."""
    rows = (
        client.table("workbuddy_access_tokens")
        .select("user_id, revoked_at")
        .eq("token_hash", digest(token))
        .limit(1)
        .execute()
        .data
    )
    if not rows or rows[0].get("revoked_at"):
        return None
    return rows[0]["user_id"]
