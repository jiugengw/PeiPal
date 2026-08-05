"""Run one activity-catalog refresh for a scheduler or manual invocation."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from supabase import create_client

from src.api.config import load_config, supabase_service_key, supabase_url
from src.services.activity_search.ingestion import JsonFileProvider, normalize_activity
from src.services.activity_search.repository import ActivityRepository


def main() -> int:
    load_config()
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, help="JSON activity file for a dry run.")
    args = parser.parse_args()

    if not args.input:
        raise SystemExit("Live provider is not configured yet. Use --input for a manual refresh.")

    provider = JsonFileProvider(args.input)
    repository = ActivityRepository(create_client(supabase_url(), supabase_service_key()))
    run_id = repository.start_ingestion("json-file")
    try:
        raw_activities = provider.search()
        normalized = [normalize_activity(activity) for activity in raw_activities]
        saved = repository.upsert_activities(normalized)
        expired = repository.expire_past_activities()
        repository.finish_ingestion(
            run_id,
            status="succeeded",
            candidates_found=len(raw_activities),
            activities_saved=saved,
            activities_expired=expired,
        )
        print(f"Saved {saved} activities and expired {expired} old activities.")
        return 0
    except Exception as error:
        repository.finish_ingestion(run_id, status="failed", error_message=str(error))
        raise


if __name__ == "__main__":
    raise SystemExit(main())
