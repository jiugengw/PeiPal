from src.services.activity_search.ingestion import ParallelActivityProvider, normalize_activity


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


def test_normalize_activity_accepts_time_without_minutes():
    result = normalize_activity({
        "name": "Evening Talk",
        "location": "Bishan Community Club",
        "date": "09/07/2026",
        "start_time": "7PM",
        "info_link": "https://example.com/evening-talk",
    })

    assert result["start_at"] == "2026-07-09T19:00:00+08:00"


def test_normalize_activity_rejects_missing_required_fields():
    try:
        normalize_activity({"name": "Incomplete"})
    except ValueError as error:
        assert "location" in str(error)
    else:
        raise AssertionError("Expected missing activity field error")


def test_parallel_provider_searches_and_extracts_event_pages():
    calls = []

    def fake_post(url, body):
        calls.append((url, body))
        if url.endswith("/search"):
            return {
                "results": [{
                    "url": "https://example.com/activity",
                    "title": "Bishan Conversation Circle",
                    "excerpts": ["12 August 2026, 10:00 AM at Bishan Community Club"],
                }]
            }
        return {
            "results": [{
                "url": "https://example.com/activity",
                "title": "Bishan Conversation Circle",
                "excerpts": [
                    "Date: 12 August 2026\nTime: 10:00 AM\n"
                    "Venue: Bishan Community Club\nFree"
                ],
            }]
        }

    provider = ParallelActivityProvider(
        "test-key",
        area="Bishan",
        start_date="2026-08-05",
        end_date="2026-09-05",
        post_json=fake_post,
    )

    activities = provider.search()

    assert len(activities) == 1
    assert activities[0]["date"] == "12/08/2026"
    assert activities[0]["start_time"] == "10:00 AM"
    assert activities[0]["location"] == "Bishan Community Club"
    assert len(calls) == 2
    assert calls[0][0].endswith("/search")
    assert calls[1][0].endswith("/extract")


def test_parallel_provider_skips_results_without_event_date():
    provider = ParallelActivityProvider(
        "test-key",
        start_date="2026-08-05",
        end_date="2026-09-05",
        post_json=lambda url, body: {
            "results": [{"url": "https://example.com", "title": "No date"}]
        },
    )

    assert provider.search() == []


def test_parallel_provider_skips_events_outside_requested_date_range():
    provider = ParallelActivityProvider(
        "test-key",
        start_date="2026-08-05",
        end_date="2026-09-05",
        post_json=lambda url, body: {
            "results": [{
                "url": "https://example.com/old-event",
                "title": "Old event",
                "excerpts": ["09 July 2026, 7PM"],
            }]
        },
    )

    assert provider.search() == []


def test_parallel_provider_reads_full_content_and_iso_dates():
    def fake_post(url, body):
        if url.endswith("/search"):
            return {"results": [{"url": "https://example.com/event", "title": "Event"}]}
        return {
            "results": [{
                "url": "https://example.com/event",
                "full_content": "Date: 2026-08-12. Time: 9:00 AM. Venue: Bishan Hall.",
            }]
        }

    provider = ParallelActivityProvider(
        "test-key",
        start_date="2026-08-05",
        end_date="2026-09-05",
        post_json=fake_post,
    )

    assert len(provider.search()) == 1
    assert provider.last_stats["pages_extracted"] == 1


def test_parallel_provider_accepts_date_ranges_and_compact_times():
    def fake_post(url, body):
        if url.endswith("/search"):
            return {"results": [{"url": "https://example.com/range", "title": "Range event"}]}
        return {
            "results": [{
                "url": "https://example.com/range",
                "full_content": "Runs 5 Aug – 30 Sep 2026. Every session starts at 10.00 a.m.",
            }]
        }

    provider = ParallelActivityProvider(
        "test-key",
        start_date="2026-08-05",
        end_date="2026-09-05",
        post_json=fake_post,
    )

    activities = provider.search()

    assert activities[0]["date"] == "05/08/2026"
    assert activities[0]["start_time"] == "10:00 AM"
