"""MCP OAuth 2.1 endpoints used by Tencent WorkBuddy."""

from __future__ import annotations

import base64
import json
import logging
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from supabase import Client

from src.api.config import oauth_frontend_url
from src.api.dependencies import get_supabase_client, user_id
from src.api.dependencies import require_user
from src.services.oauth import (
    DEFAULT_SCOPE,
    create_code,
    exchange_code,
    load_client,
    refresh,
    register_client,
    revoke_connection,
    list_connections,
)

router = APIRouter(tags=["MCP OAuth"])
logger = logging.getLogger(__name__)


class ClientRegistration(BaseModel):
    client_name: str = "MCP client"
    redirect_uris: list[str]


@router.get("/.well-known/oauth-authorization-server")
@router.get("/mcp/.well-known/oauth-authorization-server")
def oauth_metadata(request: Request) -> dict[str, Any]:
    base = str(request.base_url).rstrip("/")
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/oauth/authorize",
        "token_endpoint": f"{base}/oauth/token",
        "registration_endpoint": f"{base}/oauth/register",
        "scopes_supported": DEFAULT_SCOPE.split(),
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
    }


@router.get("/.well-known/oauth-protected-resource")
@router.get("/mcp/.well-known/oauth-protected-resource")
def protected_resource_metadata(request: Request) -> dict[str, Any]:
    base = str(request.base_url).rstrip("/")
    return {
        "resource": f"{base}/mcp",
        "authorization_servers": [base],
        "scopes_supported": DEFAULT_SCOPE.split(),
    }


@router.post("/oauth/register", status_code=status.HTTP_201_CREATED)
def register(payload: ClientRegistration, client: Client = Depends(get_supabase_client)) -> dict[str, Any]:
    if not payload.redirect_uris or any(urlparse(uri).scheme not in {"http", "https"} for uri in payload.redirect_uris):
        raise HTTPException(status_code=400, detail="redirect_uris must contain absolute HTTP(S) URLs.")
    return register_client(client, payload.client_name, payload.redirect_uris)


@router.get("/oauth/authorize")
def authorize(request: Request, client: Client = Depends(get_supabase_client)) -> RedirectResponse:
    query = dict(request.query_params)
    required = ["client_id", "redirect_uri", "response_type", "code_challenge", "state"]
    if any(not query.get(name) for name in required) or query["response_type"] != "code":
        raise HTTPException(status_code=400, detail="Invalid OAuth authorization request.")
    oauth_client = load_client(client, query["client_id"])
    if not oauth_client or query["redirect_uri"] not in oauth_client["redirect_uris"]:
        raise HTTPException(status_code=400, detail="Unknown OAuth client or redirect URI.")
    requested = set((query.get("scope") or DEFAULT_SCOPE).split())
    if not requested.issubset(set(DEFAULT_SCOPE.split())):
        raise HTTPException(status_code=400, detail="Unsupported OAuth scope.")
    frontend = oauth_frontend_url().rstrip("/") + "/oauth/authorize"
    return RedirectResponse(frontend + "?" + urlencode(query), status_code=302)


class AuthorizationApproval(BaseModel):
    client_id: str
    redirect_uri: str
    code_challenge: str
    scope: str = DEFAULT_SCOPE
    state: str


@router.post("/oauth/authorize/approve")
def approve(
    payload: AuthorizationApproval,
    user: Any = Depends(require_user),
    client: Client = Depends(get_supabase_client),
) -> dict[str, str]:
    oauth_client = load_client(client, payload.client_id)
    if not oauth_client or payload.redirect_uri not in oauth_client["redirect_uris"]:
        raise HTTPException(status_code=400, detail="Unknown OAuth client or redirect URI.")
    scope = " ".join(sorted(set(payload.scope.split()) & set(DEFAULT_SCOPE.split())))
    code = create_code(client, client_id=payload.client_id, user_id=user_id(user), redirect_uri=payload.redirect_uri,
                       code_challenge=payload.code_challenge, scope=scope)
    parsed = urlparse(payload.redirect_uri)
    query = parse_qs(parsed.query)
    query["code"] = [code]
    query["state"] = [payload.state]
    return {"redirect_url": urlunparse(parsed._replace(query=urlencode(query, doseq=True)))}


@router.post("/oauth/token")
async def token(request: Request, client: Client = Depends(get_supabase_client)) -> JSONResponse:
    raw_body = await request.body()
    if "application/json" in request.headers.get("content-type", ""):
        values = json.loads(raw_body.decode("utf-8"))
    else:
        body = parse_qs(raw_body.decode("utf-8"))
        values = {key: items[0] for key, items in body.items() if items}
    client_id = values.get("client_id", "")
    if not client_id:
        basic = request.headers.get("authorization", "")
        if basic.lower().startswith("basic "):
            try:
                client_id = base64.b64decode(basic[6:]).decode("utf-8").split(":", 1)[0]
            except (ValueError, UnicodeDecodeError):
                client_id = ""
    if not load_client(client, client_id):
        logger.warning("OAuth token rejected: unknown client_id=%s", client_id)
        return JSONResponse({"error": "invalid_client"}, status_code=400)
    logger.info(
        "OAuth token request grant_type=%s client_id=%s has_code=%s has_refresh=%s redirect_uri=%s verifier_length=%s content_type=%s",
        values.get("grant_type"), client_id, bool(values.get("code")),
        bool(values.get("refresh_token")), bool(values.get("redirect_uri")),
        len(values.get("code_verifier", "")), request.headers.get("content-type", ""),
    )
    if values.get("grant_type") == "authorization_code":
        issued = exchange_code(client, code=values.get("code", ""), client_id=client_id,
                               redirect_uri=values.get("redirect_uri"), code_verifier=values.get("code_verifier", ""))
    elif values.get("grant_type") == "refresh_token":
        issued = refresh(client, refresh_token=values.get("refresh_token", ""), client_id=client_id)
    else:
        issued = None
    if not issued:
        logger.warning("OAuth token rejected: invalid grant for client_id=%s", client_id)
        return JSONResponse({"error": "invalid_grant"}, status_code=400)
    return JSONResponse({key: value for key, value in issued.items() if not key.startswith("_")})


@router.get("/api/workbuddy/connections")
def connections(user: Any = Depends(require_user), client: Client = Depends(get_supabase_client)) -> dict[str, Any]:
    return {"connections": list_connections(client, user_id(user))}


@router.delete("/api/workbuddy/connections/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connection(client_id: str, user: Any = Depends(require_user), client: Client = Depends(get_supabase_client)) -> None:
    revoke_connection(client, user_id(user), client_id)
