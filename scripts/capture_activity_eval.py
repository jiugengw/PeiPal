"""Capture real Parallel search/extract cases without touching Supabase."""

from __future__ import annotations

import argparse
from datetime import date, timedelta
import json
from pathlib import Path
import sys
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.api.config import load_config, parallel_api_key
from src.services.activity_search.ingestion import ParallelActivityProvider


def write_jsonl(path: Path, rows: list[dict[str, Any]], *, append: bool) -> int:
    by_id: dict[str, dict[str, Any]] = {}
    if append and path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                existing = json.loads(line)
                by_id[existing["id"]] = existing
    for row in rows:
        by_id[row["id"]] = row
    path.parent.mkdir(parents=True, exist_ok=True)
    content = "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in by_id.values())
    path.write_text(content, encoding="utf-8")
    return len(by_id)


def main() -> int:
    load_config()
    parser = argparse.ArgumentParser(
        description="Capture unbiased WorkBuddy inputs and separate system predictions."
    )
    parser.add_argument("--area", default="Singapore")
    parser.add_argument("--start-date", default=date.today().isoformat())
    parser.add_argument("--end-date", default=(date.today() + timedelta(days=31)).isoformat())
    parser.add_argument("--timing", default="morning")
    parser.add_argument("--preference", default="fun and educational")
    parser.add_argument("--mobility", default="gentle, no steps")
    parser.add_argument("--max-results", type=int, default=10)
    parser.add_argument(
        "--cases-output",
        type=Path,
        default=Path("evals/activity_extraction/unlabelled.jsonl"),
    )
    parser.add_argument(
        "--predictions-output",
        type=Path,
        default=Path("evals/activity_extraction/predictions.jsonl"),
    )
    parser.add_argument("--append", action="store_true")
    args = parser.parse_args()

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
    print(
        f"[eval capture] Searching {args.area} from {args.start_date} to {args.end_date}; "
        f"preference='{args.preference}'"
    )
    provider.search()
    case_count = write_jsonl(
        args.cases_output,
        provider.last_captured_pages,
        append=args.append,
    )
    prediction_count = write_jsonl(
        args.predictions_output,
        provider.last_predictions,
        append=args.append,
    )
    print(
        f"[eval capture] Captured {len(provider.last_captured_pages)} pages; "
        f"case_file_total={case_count}; prediction_file_total={prediction_count}"
    )
    print(f"[eval capture] WorkBuddy input: {args.cases_output}")
    print(f"[eval capture] Keep hidden during labelling: {args.predictions_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
