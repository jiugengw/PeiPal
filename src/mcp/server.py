"""Streamable HTTP MCP server entrypoint for WorkBuddy."""

from __future__ import annotations

from starlette.applications import Starlette
from starlette.routing import Mount

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from src.mcp.config import load_config
from src.mcp.context import register_context
from src.mcp.tools import register_tools


load_config()

mcp = FastMCP(
    "PeiPal",
    instructions=(
        "Every tool call needs a caregiver's personal access token, generated once on "
        "the real PeiPal website (Connect an app) and configured as this connection's "
        "own bearer token — never ask a caregiver for it in chat, and never invent one. "
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
app = Starlette(
    routes=[Mount("/mcp", app=_mcp_app)],
    lifespan=_mcp_app.router.lifespan_context,
)
