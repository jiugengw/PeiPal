"""Vercel Function entrypoint for the PeiPal MCP server.

Vercel invokes this function at ``/api/mcp``. The MCP application exposes its
transport at ``/mcp`` locally, so the function maps the function root to that
transport while leaving OAuth and metadata paths unchanged.
"""

from src.mcp.server import app as _mcp_app


async def app(scope, receive, send):
    if scope.get("type") == "http" and scope.get("path") == "/":
        scope = dict(scope)
        scope["path"] = "/mcp"
        scope["raw_path"] = b"/mcp"
    await _mcp_app(scope, receive, send)


__all__ = ["app"]
