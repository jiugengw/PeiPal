"""Environment-backed configuration for the WorkBuddy MCP bridge."""

from __future__ import annotations

import os

from dotenv import load_dotenv


def load_config() -> None:
    load_dotenv()


def count_me_in_api_url() -> str:
    return os.getenv("COUNT_ME_IN_API_URL", "http://127.0.0.1:8000").rstrip("/")


def mcp_access_token() -> str:
    value = os.getenv("MCP_ACCESS_TOKEN")
    if not value:
        raise RuntimeError("MCP_ACCESS_TOKEN is not configured.")
    return value


def count_me_in_api_token() -> str:
    value = os.getenv("COUNT_ME_IN_API_TOKEN")
    if not value:
        raise RuntimeError("COUNT_ME_IN_API_TOKEN is not configured.")
    return value


def mcp_port() -> int:
    return int(os.getenv("MCP_PORT", "8001"))
