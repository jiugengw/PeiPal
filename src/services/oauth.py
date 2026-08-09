"""Small OAuth 2.1 credential store for the remote MCP server."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import base64
import hashlib
import logging
import secrets
from typing import Any

from supabase import Client

from src.services.family_email import digest

logger = logging.getLogger(__name__)

ACCESS_TOKEN_MINUTES = 15
REFRESH_TOKEN_DAYS = 30
CODE_MINUTES = 5
DEFAULT_SCOPE = "activities:read plans:read plans:write"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _token() -> str:
    return secrets.token_urlsafe(32)


def _expires(minutes: int) -> str:
    return (_now() + timedelta(minutes=minutes)).isoformat()


def register_client(client: Client, client_name: str, redirect_uris: list[str]) -> dict[str, Any]:
    client_id = f"peipal_{secrets.token_urlsafe(18)}"
    row = client.table("oauth_clients").insert({
        "client_id": client_id,
        "client_name": client_name,
        "redirect_uris": redirect_uris,
    }).execute().data[0]
    return {
        "client_id": row["client_id"],
        "client_name": row["client_name"],
        "redirect_uris": row["redirect_uris"],
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "none",
    }


def load_client(client: Client, client_id: str) -> dict[str, Any] | None:
    rows = client.table("oauth_clients").select("*").eq("client_id", client_id).limit(1).execute().data
    return rows[0] if rows else None


def create_code(client: Client, *, client_id: str, user_id: str, redirect_uri: str,
                code_challenge: str, scope: str) -> str:
    code = _token()
    client.table("oauth_authorization_codes").insert({
        "code_hash": digest(code), "client_id": client_id, "user_id": user_id,
        "redirect_uri": redirect_uri, "code_challenge": code_challenge,
        "scope": scope, "expires_at": _expires(CODE_MINUTES),
    }).execute()
    return code


def _verify_pkce(verifier: str, challenge: str) -> bool:
    encoded = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return secrets.compare_digest(encoded, challenge)


def exchange_code(client: Client, *, code: str, client_id: str, redirect_uri: str | None,
                  code_verifier: str) -> dict[str, Any] | None:
    rows = client.table("oauth_authorization_codes").select("*").eq("code_hash", digest(code)).limit(1).execute().data
    if not rows:
        logger.warning("OAuth code rejected: code not found")
        return None
    row = rows[0]
    if row.get("used_at"):
        logger.warning("OAuth code rejected: code already used")
        return None
    if row["client_id"] != client_id:
        logger.warning("OAuth code rejected: client mismatch")
        return None
    if redirect_uri and row["redirect_uri"] != redirect_uri:
        # WorkBuddy uses a loopback callback during the browser leg, then
        # reports its desktop custom-scheme callback during token exchange.
        # PKCE still binds this single-use code to the same WorkBuddy client.
        workbuddy_callback_swap = (
            row["redirect_uri"].startswith("http://127.0.0.1:")
            and redirect_uri.startswith("workbuddy-ai://workbuddy/")
        )
        if not workbuddy_callback_swap:
            logger.warning("OAuth code rejected: redirect URI mismatch stored=%s received=%s", row["redirect_uri"], redirect_uri)
            return None
        logger.info("Accepting WorkBuddy loopback-to-custom callback conversion")
    if datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00")) <= _now():
        logger.warning("OAuth code rejected: code expired")
        return None
    if not _verify_pkce(code_verifier, row["code_challenge"]):
        logger.warning("OAuth code rejected: PKCE mismatch")
        return None
    client.table("oauth_authorization_codes").update({"used_at": _now().isoformat()}).eq("code_hash", digest(code)).execute()
    return _issue_tokens(client, client_id=row["client_id"], user_id=row["user_id"], scope=row["scope"])


def refresh(client: Client, *, refresh_token: str, client_id: str) -> dict[str, Any] | None:
    rows = client.table("oauth_refresh_tokens").select("*").eq("token_hash", digest(refresh_token)).eq("token_type", "refresh").limit(1).execute().data
    if not rows:
        return None
    row = rows[0]
    if row.get("revoked_at") or row["client_id"] != client_id or datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00")) <= _now():
        return None
    client.table("oauth_refresh_tokens").update({"revoked_at": _now().isoformat()}).eq("token_hash", digest(refresh_token)).execute()
    return _issue_tokens(client, client_id=client_id, user_id=row["user_id"], scope=row["scope"])


def _issue_tokens(client: Client, *, client_id: str, user_id: str, scope: str) -> dict[str, Any]:
    access = _token()
    refresh_token = _token()
    client.table("oauth_refresh_tokens").insert([
        {"token_hash": digest(refresh_token), "token_type": "refresh", "client_id": client_id,
        "user_id": user_id, "scope": scope,
        "expires_at": (_now() + timedelta(days=REFRESH_TOKEN_DAYS)).isoformat(),
        },
        {"token_hash": digest(access), "token_type": "access", "client_id": client_id,
         "user_id": user_id, "scope": scope,
         "expires_at": (_now() + timedelta(minutes=ACCESS_TOKEN_MINUTES)).isoformat(),
        },
    ]).execute()
    return {
        "access_token": access, "refresh_token": refresh_token,
        "token_type": "Bearer", "expires_in": ACCESS_TOKEN_MINUTES * 60,
        "scope": scope,
    }


def resolve_access_token(client: Client, token: str) -> tuple[str, set[str]] | None:
    rows = client.table("oauth_refresh_tokens").select("user_id, scope, expires_at, revoked_at").eq("token_hash", digest(token)).eq("token_type", "access").limit(1).execute().data
    if not rows:
        return None
    row = rows[0]
    if row.get("revoked_at") or datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00")) <= _now():
        return None
    return str(row["user_id"]), set(row["scope"].split())


def list_connections(client: Client, user_id: str) -> list[dict[str, Any]]:
    rows = client.table("oauth_refresh_tokens").select("client_id, scope, created_at, expires_at, revoked_at").eq("user_id", user_id).eq("token_type", "refresh").execute().data or []
    latest: dict[str, dict[str, Any]] = {}
    for row in rows:
        if row["client_id"] not in latest or row["created_at"] > latest[row["client_id"]]["created_at"]:
            latest[row["client_id"]] = row
    return list(latest.values())


def revoke_connection(client: Client, user_id: str, client_id: str) -> None:
    client.table("oauth_refresh_tokens").update({"revoked_at": _now().isoformat()}).eq("user_id", user_id).eq("client_id", client_id).execute()
