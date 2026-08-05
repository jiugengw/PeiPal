"""Persistence operations for the Supabase activity catalog."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

from supabase import Client


class ActivityRepository:
    def __init__(self, client: Client) -> None:
        self.client = client

    def start_ingestion(self, provider: str) -> int:
        result = self.client.table("activity_ingestion_runs").insert({
            "provider": provider,
            "status": "running",
        }).execute()
        return int(result.data[0]["id"])

    def finish_ingestion(
        self,
        run_id: int,
        *,
        status: str,
        candidates_found: int = 0,
        activities_saved: int = 0,
        activities_expired: int = 0,
        error_message: str | None = None,
    ) -> None:
        self.client.table("activity_ingestion_runs").update({
            "status": status,
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "candidates_found": candidates_found,
            "activities_saved": activities_saved,
            "activities_expired": activities_expired,
            "error_message": error_message,
        }).eq("id", run_id).execute()

    def upsert_activities(self, activities: Iterable[dict[str, Any]]) -> int:
        rows = list(activities)
        if not rows:
            return 0
        self.client.table("activities").upsert(
            rows,
            on_conflict="dedupe_key",
        ).execute()
        return len(rows)

    def expire_past_activities(self) -> int:
        result = (
            self.client.table("activities")
            .update({"status": "expired", "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("status", "active")
            .lt("start_at", datetime.now(timezone.utc).isoformat())
            .execute()
        )
        return len(result.data or [])

    def find_active(self, location: str | None = None, limit: int = 3) -> list[dict[str, Any]]:
        query = (
            self.client.table("activities")
            .select("*")
            .eq("status", "active")
            .gte("start_at", datetime.now(timezone.utc).isoformat())
            .order("total_score", desc=True)
            .limit(limit)
        )
        if location:
            query = query.ilike("location", f"%{location}%")
        return query.execute().data or []
