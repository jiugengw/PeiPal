"""Streamable HTTP MCP server entrypoint for WorkBuddy."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from mcp.server.fastmcp import FastMCP
from starlette.applications import Starlette
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Mount

from src.mcp.config import load_config, mcp_access_token
from src.mcp.context import register_context
from src.mcp.tools import register_tools


load_config()

mcp = FastMCP(
    "PeiPal",
    instructions=(
        "Use PeiPal tools to find activities and create plans for older adults. "
        "Never invent activity, household, older-adult, or plan IDs. Confirm before writes."
    ),
    stateless_http=True,
    json_response=True,
    streamable_http_path="/",
)
register_tools(mcp)
register_context(mcp)


class MCPBearerMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        authorization = request.headers.get("authorization", "")
        expected = f"Bearer {mcp_access_token()}"
        if authorization != expected:
            return JSONResponse({"error": "Invalid MCP bearer token."}, status_code=401)
        return await call_next(request)


_mcp_app = mcp.streamable_http_app()
app = Starlette(
    routes=[Mount("/mcp", app=MCPBearerMiddleware(_mcp_app))],
    lifespan=_mcp_app.router.lifespan_context,
)
