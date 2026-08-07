"""Deterministic, older-adult-specific activity recommendations."""

from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any


def _terms(value: str | None) -> list[str]:
    return [term for term in re.findall(r"[a-z0-9]+", (value or "").lower()) if len(term) > 1]


def _interest_match(activity: dict[str, Any], interest: str | None) -> float:
    terms = _terms(interest)
    if not terms:
        return 50.0
    searchable = " ".join(
        [
            str(activity.get("name") or ""),
            str(activity.get("description") or ""),
            " ".join(str(tag) for tag in activity.get("tags") or []),
        ]
    ).lower()
    matches = sum(term in searchable for term in terms)
    return round(matches / len(terms) * 100, 2)


def _mobility_match(activity: dict[str, Any], older_adult: dict[str, Any], mobility: str | None = None) -> float:
    notes = str(mobility or older_adult.get("mobility_notes") or "").lower()
    if not notes:
        return 50.0
    intensity = str(activity.get("intensity") or "").lower()
    activity_notes = str(activity.get("mobility_notes") or "").lower()
    gentle_request = any(term in notes for term in ("seated", "gentle", "no steps", "low impact"))
    gentle_activity = intensity in {"gentle", "light"} or any(
        term in activity_notes for term in ("seated", "step-free", "no steps", "chair")
    )
    if gentle_request:
        return 100.0 if gentle_activity else 20.0
    return 75.0 if gentle_activity else 60.0


def _cost_match(activity: dict[str, Any], max_cost: float | None) -> float:
    if max_cost is None:
        return 50.0
    cost = activity.get("cost")
    if cost is None:
        return 50.0
    return 100.0 if float(cost) <= max_cost else 0.0


def _location_match(activity: dict[str, Any], location: str | None) -> float:
    if not location or not location.strip():
        return 50.0
    requested = location.strip().lower()
    actual = str(activity.get("location") or "").lower()
    return 100.0 if requested in actual or actual in requested else 0.0


def score_activity(
    activity: dict[str, Any],
    older_adult: dict[str, Any],
    *,
    interest: str | None,
    max_cost: float | None,
    location: str | None,
    mobility: str | None = None,
) -> tuple[float, dict[str, float]]:
    factors = {
        "interest_match": _interest_match(activity, interest),
        "mobility_match": _mobility_match(activity, older_adult, mobility),
        "cost_match": _cost_match(activity, max_cost),
        "location_match": _location_match(activity, location),
    }
    score = (
        factors["interest_match"] * 0.35
        + factors["mobility_match"] * 0.30
        + factors["cost_match"] * 0.20
        + factors["location_match"] * 0.15
    )
    return round(score, 2), factors


def recommend_activities(
    client: Any,
    older_adult_id: int,
    *,
    interest: str | None = None,
    max_cost: float | None = None,
    location: str | None = None,
    mobility: str | None = None,
    activity_id: int | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    profile_result = (
        client.table("older_adult_profiles")
        .select("*")
        .eq("id", older_adult_id)
        .limit(1)
        .execute()
    )
    profiles = profile_result.data or []
    if not profiles:
        raise LookupError("Older-adult profile not found.")
    older_adult = profiles[0]
    now = datetime.now(timezone.utc).isoformat()
    query = (
        client.table("activities")
        .select("*")
        .eq("status", "active")
        .gte("start_at", now)
        .order("start_at", desc=False)
        .limit(100)
    )
    activities = query.execute().data or []
    scored: list[dict[str, Any]] = []
    context = {
        "interest": interest,
        "max_cost": max_cost,
        "location": location,
    }
    for activity in activities:
        if activity_id is not None and int(activity.get("id")) != activity_id:
            continue
        if max_cost is not None and activity.get("cost") is not None and float(activity["cost"]) > max_cost:
            continue
        score, factors = score_activity(
            activity,
            older_adult,
            interest=interest,
            max_cost=max_cost,
            location=location,
            mobility=mobility,
        )
        row = {
            "older_adult_id": older_adult_id,
            "activity_id": activity["id"],
            "recommendation_score": score,
            "match_factors": factors,
            "request_context": context,
            "expires_at": activity.get("start_at"),
            "updated_at": now,
        }
        scored.append({"activity": activity, "recommendation_score": score, "match_factors": factors, "_row": row})
    scored.sort(key=lambda item: (-item["recommendation_score"], item["activity"].get("start_at", "")))
    selected = scored[: max(1, min(limit, 20))]
    if selected:
        client.table("activity_recommendations").upsert(
            [item.pop("_row") for item in selected], on_conflict="older_adult_id,activity_id"
        ).execute()
    return selected
