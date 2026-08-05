"""Compare extractor predictions with WorkBuddy-assisted gold labels."""

from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import sys
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.services.activity_search.ingestion import parse_activity_text


EVALUATED_FIELDS = (
    "is_event",
    "is_recommendable",
    "date",
    "start_time",
    "venue",
    "registration_url",
)


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f"Invalid JSON on line {line_number} of {path}: {error}") from error
        if "id" not in row:
            raise ValueError(f"Row {line_number} of {path} is missing 'id'.")
        rows.append(row)
    return rows


def _legacy_predictions(
    cases: list[dict[str, Any]],
    *,
    area: str,
    start_date: str,
    end_date: str,
) -> list[dict[str, Any]]:
    predictions = []
    for case in cases:
        if "text" not in case:
            raise ValueError("--predictions is required for captured WorkBuddy-labelled cases.")
        predictions.append({
            "id": case["id"],
            "title": case.get("title", ""),
            "url": case.get("url", ""),
            "actual": parse_activity_text(
                case["text"],
                area=area,
                start_date=start_date,
                end_date=end_date,
                source_url=case.get("url"),
            ),
        })
    return predictions


def evaluate_cases(
    cases: list[dict[str, Any]],
    predictions: list[dict[str, Any]] | None = None,
    *,
    area: str = "Bishan",
    start_date: str = "2026-08-05",
    end_date: str = "2026-09-05",
) -> dict[str, Any]:
    predictions = predictions or _legacy_predictions(
        cases,
        area=area,
        start_date=start_date,
        end_date=end_date,
    )
    prediction_by_id = {row["id"]: row for row in predictions}
    failures = []
    counts = Counter()
    field_counts: dict[str, Counter[str]] = {
        field: Counter() for field in ("date", "start_time", "venue", "registration_url")
    }
    page_types = Counter()

    for case in cases:
        expected = case.get("expected")
        if not isinstance(expected, dict):
            raise ValueError(f"Case {case['id']} is missing an expected label object.")
        prediction = prediction_by_id.get(case["id"])
        if prediction is None:
            counts["missing_predictions"] += 1
            failures.append({"id": case["id"], "reason": "missing system prediction"})
            continue

        actual = prediction.get("actual") or {}
        counts["labelled_cases"] += 1
        if expected.get("review_status") in ("human_confirmed", "human_corrected"):
            counts["human_reviewed_cases"] += 1
        if expected.get("confidence", 1) < 0.8:
            counts["low_confidence_labels"] += 1
        if expected.get("page_type"):
            page_types[str(expected["page_type"])] += 1
        if "matches_preference" in expected:
            counts["preference_labelled"] += 1
            if expected.get("matches_preference") is True:
                counts["preference_matches"] += 1
        if "matches_area" in expected:
            counts["area_labelled"] += 1
            if expected.get("matches_area") is True:
                counts["area_matches"] += 1
        if expected.get("mobility_suitable") is not None:
            counts["mobility_labelled"] += 1
            if expected.get("mobility_suitable") is True:
                counts["mobility_matches"] += 1

        expected_event = bool(expected.get("is_event"))
        actual_event = bool(actual.get("is_event"))
        if expected_event and actual_event:
            counts["true_positive"] += 1
        elif not expected_event and actual_event:
            counts["false_positive"] += 1
        elif expected_event and not actual_event:
            counts["false_negative"] += 1
        else:
            counts["true_negative"] += 1

        expected_recommendable = bool(
            expected.get("is_recommendable", expected_event)
        )
        actual_recommendable = bool(
            actual.get("is_recommendable", actual_event)
        )
        if expected_recommendable and actual_recommendable:
            counts["recommendation_true_positive"] += 1
        elif not expected_recommendable and actual_recommendable:
            counts["recommendation_false_positive"] += 1
        elif expected_recommendable and not actual_recommendable:
            counts["recommendation_false_negative"] += 1
        else:
            counts["recommendation_true_negative"] += 1

        mismatches = {}
        for field in EVALUATED_FIELDS:
            if field not in expected:
                continue
            expected_value = expected.get(field)
            actual_value = actual.get(field)
            if field not in ("is_event", "is_recommendable") and expected_value is not None:
                field_counts[field]["total"] += 1
                if actual_value == expected_value:
                    field_counts[field]["correct"] += 1
            if actual_value != expected_value:
                mismatches[field] = {
                    "expected": expected_value,
                    "actual": actual_value,
                }
        if mismatches:
            counts["failed_cases"] += 1
            failures.append({
                "id": case["id"],
                "title": prediction.get("title", ""),
                "url": prediction.get("url", ""),
                "mismatches": mismatches,
            })

    tp = counts["true_positive"]
    fp = counts["false_positive"]
    fn = counts["false_negative"]
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    recommendation_tp = counts["recommendation_true_positive"]
    recommendation_fp = counts["recommendation_false_positive"]
    recommendation_fn = counts["recommendation_false_negative"]
    recommendation_precision = (
        recommendation_tp / (recommendation_tp + recommendation_fp)
        if recommendation_tp + recommendation_fp
        else 0.0
    )
    recommendation_recall = (
        recommendation_tp / (recommendation_tp + recommendation_fn)
        if recommendation_tp + recommendation_fn
        else 0.0
    )
    field_accuracy = {
        field: {
            "correct": values["correct"],
            "total": values["total"],
            "accuracy": values["correct"] / values["total"] if values["total"] else None,
        }
        for field, values in field_counts.items()
    }
    return {
        "summary": {
            "labelled_cases": counts["labelled_cases"],
            "human_reviewed_cases": counts["human_reviewed_cases"],
            "low_confidence_labels": counts["low_confidence_labels"],
            "missing_predictions": counts["missing_predictions"],
            "true_positive": tp,
            "false_positive": fp,
            "false_negative": fn,
            "true_negative": counts["true_negative"],
            "failed_cases": counts["failed_cases"],
            "event_precision": precision,
            "event_recall": recall,
            "recommendation_precision": recommendation_precision,
            "recommendation_recall": recommendation_recall,
            "usable_event_rate": (
                (recommendation_tp + recommendation_fn) / counts["labelled_cases"]
                if counts["labelled_cases"]
                else 0.0
            ),
            "preference_match_rate": (
                counts["preference_matches"] / counts["preference_labelled"]
                if counts["preference_labelled"]
                else None
            ),
            "area_match_rate": (
                counts["area_matches"] / counts["area_labelled"]
                if counts["area_labelled"]
                else None
            ),
            "mobility_match_rate": (
                counts["mobility_matches"] / counts["mobility_labelled"]
                if counts["mobility_labelled"]
                else None
            ),
        },
        "page_type_distribution": dict(page_types),
        "field_accuracy": field_accuracy,
        "failures": failures,
    }


def markdown_report(report: dict[str, Any]) -> str:
    summary = report["summary"]
    preference_rate = summary["preference_match_rate"]
    area_rate = summary["area_match_rate"]
    lines = [
        "# Activity extraction evaluation",
        "",
        f"- Labelled cases: {summary['labelled_cases']}",
        f"- Human-reviewed cases: {summary['human_reviewed_cases']}",
        f"- Event precision: {summary['event_precision']:.1%}",
        f"- Event recall: {summary['event_recall']:.1%}",
        f"- Recommendation precision: {summary['recommendation_precision']:.1%}",
        f"- Recommendation recall: {summary['recommendation_recall']:.1%}",
        f"- Usable-event rate: {summary['usable_event_rate']:.1%}",
        f"- Preference-match rate: {'n/a' if preference_rate is None else f'{preference_rate:.1%}'}",
        f"- Area-match rate: {'n/a' if area_rate is None else f'{area_rate:.1%}'}",
        f"- Failed cases: {summary['failed_cases']}",
        "",
        "## Field accuracy",
        "",
    ]
    for field, values in report["field_accuracy"].items():
        accuracy = "n/a" if values["accuracy"] is None else f"{values['accuracy']:.1%}"
        lines.append(f"- {field}: {accuracy} ({values['correct']}/{values['total']})")
    lines.extend(["", "## Failures", ""])
    if not report["failures"]:
        lines.append("No mismatches.")
    for failure in report["failures"]:
        title = failure.get("title") or failure["id"]
        url = failure.get("url")
        lines.append(f"### [{title}]({url})" if url else f"### {title}")
        lines.append("")
        if failure.get("reason"):
            lines.append(f"- {failure['reason']}")
        for field, mismatch in failure.get("mismatches", {}).items():
            lines.append(
                f"- {field}: expected `{mismatch['expected']}`, got `{mismatch['actual']}`"
            )
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases", type=Path, required=True)
    parser.add_argument("--predictions", type=Path)
    parser.add_argument("--area", default="Bishan")
    parser.add_argument("--start-date", default="2026-08-05")
    parser.add_argument("--end-date", default="2026-09-05")
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("evals/activity_extraction/latest_report.json"),
    )
    parser.add_argument(
        "--markdown-report",
        type=Path,
        default=Path("evals/activity_extraction/latest_report.md"),
    )
    parser.add_argument("--fail-on-mismatch", action="store_true")
    args = parser.parse_args()

    cases = load_jsonl(args.cases)
    predictions = load_jsonl(args.predictions) if args.predictions else None
    report = evaluate_cases(
        cases,
        predictions,
        area=args.area,
        start_date=args.start_date,
        end_date=args.end_date,
    )
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.markdown_report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    args.markdown_report.write_text(markdown_report(report), encoding="utf-8")
    print(json.dumps(report["summary"], indent=2))
    print(f"JSON report: {args.report}")
    print(f"Markdown report: {args.markdown_report}")
    return 1 if args.fail_on_mismatch and report["summary"]["failed_cases"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
