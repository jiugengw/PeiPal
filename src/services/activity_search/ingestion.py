"""Normalize activity search output before it reaches PostgreSQL."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Any, Protocol
from zoneinfo import ZoneInfo


SINGAPORE = ZoneInfo("Asia/Singapore")


class ActivityProvider(Protocol):
    def search(self) -> list[dict[str, Any]]: ...


def _cost(value: Any) -> float | None:
    if value in (None, "", "Unknown", "unknown"):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    digits = "".join(character for character in str(value) if character.isdigit() or character == ".")
    return float(digits) if digits else None


def normalize_activity(raw: dict[str, Any]) -> dict[str, Any]:
    required = ("name", "location", "date", "start_time", "info_link")
    missing = [field for field in required if not str(raw.get(field, "")).strip()]
    if missing:
        raise ValueError(f"Activity is missing required fields: {', '.join(missing)}")

    start = datetime.strptime(
        f"{raw['date']} {raw['start_time']}", "%d/%m/%Y %I:%M %p"
    ).replace(tzinfo=SINGAPORE)
    info_link = str(raw["info_link"]).strip()
    dedupe_key = str(raw.get("dedupe_key") or f"{info_link}|{start.isoformat()}")
    content_hash = hashlib.sha256(
        json.dumps(raw, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()
    checked_at = datetime.now(timezone.utc).isoformat()

    return {
        "dedupe_key": dedupe_key,
        "name": str(raw["name"]).strip(),
        "description": raw.get("description"),
        "location": str(raw["location"]).strip(),
        "start_at": start.isoformat(),
        "cost": _cost(raw.get("cost")),
        "currency": raw.get("currency", "SGD"),
        "price_remarks": raw.get("price_remarks"),
        "slots_availability": raw.get("slots_availability"),
        "info_link": info_link,
        "signup_link": raw.get("signup_link"),
        "mobility_notes": raw.get("mobility_notes"),
        "intensity": raw.get("intensity"),
        "tags": raw.get("tags") or [],
        "suitability_score": raw.get("suitability_score"),
        "engagement_score": raw.get("engagement_score"),
        "total_score": raw.get("total_score"),
        "status": "active",
        "last_seen_at": checked_at,
        "last_checked_at": checked_at,
        "content_hash": content_hash,
    }


class JsonFileProvider:
    """Small deterministic provider for local tests and manual dry runs."""

    def __init__(self, path: Path) -> None:
        self.path = path

    def search(self) -> list[dict[str, Any]]:
        data = json.loads(self.path.read_text(encoding="utf-8"))
        activities = data.get("activities") if isinstance(data, dict) else data
        if not isinstance(activities, list):
            raise ValueError("Activity input must be a JSON list or an activities object.")
        return activities
