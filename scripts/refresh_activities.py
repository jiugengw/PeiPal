"""Run one activity-catalog refresh for a scheduler or manual invocation."""

from __future__ import annotations

import argparse
from datetime import date, timedelta
from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from supabase import create_client

from src.api.config import load_config, parallel_api_key, supabase_service_key, supabase_url
from src.services.activity_search.ingestion import (
    JsonFileProvider,
    ParallelActivityProvider,
    normalize_activity,
)
from src.services.activity_search.repository import ActivityRepository


def main() -> int:
    load_config()
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=("parallel", "json"), default="parallel")
    parser.add_argument("--input", type=Path, help="JSON activity file for a dry run.")
    parser.add_argument("--area", default="Singapore")
    parser.add_argument("--start-date", default=date.today().isoformat())
    parser.add_argument(
        "--end-date",
        default=(date.today() + timedelta(days=31)).isoformat(),
    )
    parser.add_argument("--timing", default="morning")
    parser.add_argument("--preference", default="social activities and talks")
    parser.add_argument("--mobility", default="gentle, no steps")
    parser.add_argument("--max-results", type=int, default=10)
    args = parser.parse_args()

    if args.provider == "json" and not args.input:
        raise SystemExit("--input is required when using --provider json.")
    if args.provider == "parallel" and args.input:
        raise SystemExit("Do not combine --input with --provider parallel.")

    if args.provider == "json":
        provider = JsonFileProvider(args.input)
    else:
        provider = ParallelActivityProvider(
            parallel_api_key(),
            area=args.area,
            start_date=args.start_date,
            end_date=args.end_date,
            timing=args.timing,
            preference=args.preference,
            mobility=args.mobility,
            max_results=args.max_results,
        )
    repository = ActivityRepository(create_client(supabase_url(), supabase_service_key()))
    run_id = repository.start_ingestion(args.provider)
    try:
        print(
            f"[activity search] Searching {args.area} activities from "
            f"{args.start_date} to {args.end_date}; timing='{args.timing}'; "
            f"preference='{args.preference}'; mobility='{args.mobility}'"
        )
        raw_activities = provider.search()
        print(f"[activity search] Found {len(raw_activities)} activities with usable dates")
        if hasattr(provider, "last_stats"):
            stats = provider.last_stats
            print(
                "[activity search] Diagnostics: "
                f"search_results={stats['search_results']}; "
                f"pages_extracted={stats['pages_extracted']}; "
                f"missing_date_or_time={stats['skipped_missing_date_or_time']}; "
                f"outside_date_range={stats['skipped_outside_date_range']}"
            )
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
        print(f"[activity search] Saved {saved} activities and expired {expired} old activities.")
        return 0
    except Exception as error:
        repository.finish_ingestion(run_id, status="failed", error_message=str(error))
        raise


if __name__ == "__main__":
    raise SystemExit(main())
