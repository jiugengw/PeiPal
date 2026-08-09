"""Vercel Function entrypoint for the PeiPal MCP server.

Vercel invokes this function at ``/api/mcp``. The MCP application exposes its
transport at ``/mcp`` locally, so the function maps the function root to that
transport while leaving OAuth and metadata paths unchanged.
"""

from src.mcp.server import app as _mcp_app


async def app(scope, receive, send):
    if scope.get("type") == "http":
        scope = dict(scope)
        # Make request.base_url include Vercel's function prefix so the OAuth
        # metadata advertises /api/mcp/oauth/* endpoints, not root-level URLs.
        scope["root_path"] = "/api/mcp"
        path = scope.get("path", "")
        if path == "/api/mcp" or path == "/api/mcp/":
            scope["path"] = "/mcp"
            scope["raw_path"] = b"/mcp"
        elif path.startswith("/api/mcp/"):
            scope["path"] = path.removeprefix("/api/mcp") or "/"
            scope["raw_path"] = scope["path"].encode("utf-8")
        elif path == "/":
            scope["path"] = "/mcp"
            scope["raw_path"] = b"/mcp"
    await _mcp_app(scope, receive, send)


__all__ = ["app"]
