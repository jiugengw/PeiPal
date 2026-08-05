from src.services.activity_search.ingestion import normalize_activity


def test_normalize_activity_builds_singapore_timestamp_and_dedupe_key():
    result = normalize_activity({
        "name": "Gentle Walk",
        "location": "Bishan Park",
        "date": "10/08/2026",
        "start_time": "9:00 am",
        "cost": "$3",
        "info_link": "https://example.com/gentle-walk",
    })

    assert result["start_at"] == "2026-08-10T09:00:00+08:00"
    assert result["cost"] == 3.0
    assert result["dedupe_key"].startswith("https://example.com/gentle-walk|")


def test_normalize_activity_rejects_missing_required_fields():
    try:
        normalize_activity({"name": "Incomplete"})
    except ValueError as error:
        assert "location" in str(error)
    else:
        raise AssertionError("Expected missing activity field error")
