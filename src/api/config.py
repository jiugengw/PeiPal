"""Environment-backed API configuration."""

from __future__ import annotations

import os

from dotenv import load_dotenv


def load_config() -> None:
    """Load local development variables without overriding deployment values."""
    load_dotenv()


def supabase_url() -> str:
    value = os.getenv("SUPABASE_URL")
    if not value:
        raise RuntimeError("SUPABASE_URL is not configured.")
    return value


def supabase_service_key() -> str:
    value = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not value:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is not configured.")
    return value


def cors_origins() -> list[str]:
    value = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:5500")
    return [origin.strip() for origin in value.split(",") if origin.strip()]
