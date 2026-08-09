"""Vercel Function entrypoint for the PeiPal MCP server.

Vercel invokes this function at ``/api/mcp``. The MCP application exposes its
transport at ``/mcp`` locally, so the function maps the function root to that
transport while leaving OAuth and metadata paths unchanged.
"""

from src.mcp.server import app as _mcp_app


async def app(scope, receive, send):
    if scope.get("type") == "http":
        scope = dict(scope)
        path = scope.get("path", "")
        if path == "/api/mcp" or path == "/api/mcp/":
            # Direct access to the Vercel function remains supported.
            scope["root_path"] = "/api/mcp"
            scope["path"] = "/mcp"
            scope["raw_path"] = b"/mcp"
        elif path.startswith("/api/mcp/"):
            scope["root_path"] = "/api/mcp"
            scope["path"] = path.removeprefix("/api/mcp") or "/"
            scope["raw_path"] = scope["path"].encode("utf-8")
        elif path == "/":
            scope["root_path"] = ""
            scope["path"] = "/mcp"
            scope["raw_path"] = b"/mcp"
        else:
            # The MCP Vercel project's catch-all rewrite preserves public
            # paths. Keeping an empty root path lets /mcp behave exactly like
            # the local server, with root-level OAuth discovery endpoints.
            scope["root_path"] = ""
    await _mcp_app(scope, receive, send)


__all__ = ["app"]
