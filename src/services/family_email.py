"""Email verification and invitation helpers for family setup."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import secrets


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def expires_in(minutes: int = 30) -> str:
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()
