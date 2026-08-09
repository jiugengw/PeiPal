"""Streamable HTTP MCP server entrypoint for WorkBuddy."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.applications import Starlette
from starlette.routing import Mount, Route

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from src.mcp.config import load_config
from src.mcp.context import register_context
from src.mcp.tools import register_tools
from src.api.oauth import router as oauth_router


load_config()

mcp = FastMCP(
    "PeiPal",
    instructions=(
        "Every tool call needs the caregiver's OAuth connection to PeiPal. WorkBuddy "
        "must complete the OAuth consent flow before calling tools; never ask a "
        "caregiver for a token in chat, and never invent one. "
        "Use PeiPal tools to find activities and create plans for older adults. Never "
        "invent activity, family, older-adult, or plan IDs. Confirm before writes."
    ),
    stateless_http=True,
    json_response=True,
    streamable_http_path="/",
    # This server is reached both locally (WorkBuddy) and remotely, behind a
    # tunnel or real deployment (ChatGPT). FastMCP auto-enables Host-header
    # checking restricted to 127.0.0.1/localhost unless told otherwise, which
    # would reject every remote caller's real Host header. Access is already
    # gated per-call by each caregiver's personal access token, so that
    # host-based check is both redundant here and actively breaks remote use.
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)
register_tools(mcp)
register_context(mcp)


_mcp_app = mcp.streamable_http_app()
_oauth_app = FastAPI(title="PeiPal MCP OAuth")
_oauth_app.add_middleware(
    CORSMiddleware,
    # These are public OAuth discovery/registration endpoints meant to be
    # reachable by any MCP client per spec, not just PeiPal's own frontend.
    # The real protection is PKCE, redirect_uri matching, and bearer tokens -
    # restricting CORS here only breaks legitimate clients, not attackers
    # (who are not bound by CORS anyway). No cookies are used, so this is
    # safe without allow_credentials.
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
_oauth_app.include_router(oauth_router)


class _McpNoSlash:
    """Serve the MCP transport at /mcp as well as the SDK's /mcp/."""

    async def __call__(self, scope, receive, send):
        headers = dict(scope.get("headers", []))
        if scope.get("method") in {"GET", "POST", "DELETE"} and b"authorization" not in headers:
            host = headers.get(b"host", b"127.0.0.1:8001").decode("latin-1")
            scheme = headers.get(b"x-forwarded-proto", b"http").decode("latin-1")
            metadata = f"{scheme}://{host}/.well-known/oauth-protected-resource"
            await send({
                "type": "http.response.start",
                "status": 401,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"www-authenticate", f'Bearer resource_metadata="{metadata}"'.encode("latin-1")),
                ],
            })
            await send({"type": "http.response.body", "body": b'{"detail":"OAuth authorization required."}'})
            return
        child_scope = dict(scope)
        child_scope["path"] = "/"
        child_scope["raw_path"] = b"/"
        child_scope["root_path"] = "/mcp"
        await _mcp_app(child_scope, receive, send)


class _McpAuthApp:
    """Apply the same OAuth challenge to the SDK's trailing-slash mount."""

    async def __call__(self, scope, receive, send):
        await _McpNoSlash().__call__(scope, receive, send)


app = Starlette(
    routes=[Route("/mcp", _McpNoSlash(), methods=["GET", "POST", "DELETE", "OPTIONS"]), Mount("/mcp", app=_McpAuthApp()), Mount("", app=_oauth_app)],
    lifespan=_mcp_app.router.lifespan_context,
)
