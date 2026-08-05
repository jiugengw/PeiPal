import json

from scripts.capture_activity_eval import write_jsonl
from scripts.evaluate_activity_extraction import evaluate_cases, markdown_report


def test_write_jsonl_appends_and_deduplicates_by_case_id(tmp_path):
    path = tmp_path / "cases.jsonl"
    write_jsonl(path, [{"id": "one", "value": 1}], append=False)
    count = write_jsonl(
        path,
        [{"id": "one", "value": 2}, {"id": "two", "value": 3}],
        append=True,
    )

    rows = [json.loads(line) for line in path.read_text().splitlines()]
    assert count == 2
    assert rows == [{"id": "one", "value": 2}, {"id": "two", "value": 3}]


def test_evaluator_compares_workbuddy_labels_with_hidden_predictions():
    cases = [{
        "id": "event-1",
        "expected": {
            "page_type": "specific_event",
            "is_event": True,
            "is_recommendable": True,
            "matches_preference": True,
            "date": "12/08/2026",
            "start_time": "10:00 AM",
            "venue": "Bishan Library",
            "registration_url": "https://example.com/register",
            "confidence": 0.95,
            "review_status": "human_confirmed",
        },
    }]
    predictions = [{
        "id": "event-1",
        "title": "Senior Talk",
        "url": "https://example.com/register",
        "actual": {
            "is_event": True,
            "is_recommendable": True,
            "date": "12/08/2026",
            "start_time": "10:00 AM",
            "venue": "Bishan Library",
            "registration_url": "https://example.com/register",
        },
    }]

    report = evaluate_cases(cases, predictions)

    assert report["summary"]["event_precision"] == 1.0
    assert report["summary"]["event_recall"] == 1.0
    assert report["summary"]["recommendation_precision"] == 1.0
    assert report["summary"]["human_reviewed_cases"] == 1
    assert report["field_accuracy"]["date"]["accuracy"] == 1.0
    assert "Event precision: 100.0%" in markdown_report(report)


def test_evaluator_reports_false_positive():
    cases = [{"id": "directory", "expected": {"is_event": False}}]
    predictions = [{
        "id": "directory",
        "title": "Events directory",
        "url": "https://example.com/events",
        "actual": {"is_event": True},
    }]

    report = evaluate_cases(cases, predictions)

    assert report["summary"]["false_positive"] == 1
    assert report["summary"]["failed_cases"] == 1
