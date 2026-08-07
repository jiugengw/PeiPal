"""Environment-backed configuration for the WorkBuddy MCP bridge."""

from __future__ import annotations

import os

from dotenv import load_dotenv


def load_config() -> None:
    load_dotenv()


def peipal_api_url() -> str:
    return os.getenv("PEIPAL_API_URL", "http://127.0.0.1:8000").rstrip("/")


def mcp_access_token() -> str:
    value = os.getenv("MCP_ACCESS_TOKEN")
    if not value:
        raise RuntimeError("MCP_ACCESS_TOKEN is not configured.")
    return value


def peipal_api_token() -> str:
    value = os.getenv("PEIPAL_API_TOKEN")
    if not value:
        raise RuntimeError("PEIPAL_API_TOKEN is not configured.")
    return value


def mcp_port() -> int:
    return int(os.getenv("MCP_PORT", "8001"))
