from datetime import datetime, timezone, timedelta

from src.services.recommendations import recommend_activities, score_activity


def activity(**overrides):
    value = {
        "id": 1,
        "name": "Gentle Music Circle",
        "description": "Songs and conversation",
        "location": "Bishan Community Club",
        "cost": 5,
        "tags": ["music", "social"],
        "intensity": "gentle",
        "mobility_notes": "Seated activity",
        "status": "active",
        "start_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
    }
    value.update(overrides)
    return value


def test_score_is_deterministic_and_matches_interest_and_mobility():
    person = {"mobility_notes": "Prefers seated activities"}
    first = score_activity(activity(), person, interest="music", max_cost=10, location="Bishan")
    second = score_activity(activity(), person, interest="music", max_cost=10, location="Bishan")
    assert first == second
    score, factors = first
    assert score > 90
    assert factors == {
        "interest_match": 100.0,
        "mobility_match": 100.0,
        "cost_match": 100.0,
        "location_match": 100.0,
    }


def test_unknown_preferences_are_neutral():
    score, factors = score_activity(activity(), {}, interest=None, max_cost=None, location=None)
    assert factors == {
        "interest_match": 50.0,
        "mobility_match": 50.0,
        "cost_match": 50.0,
        "location_match": 50.0,
    }
    assert score == 50.0


class Query:
    def __init__(self, records):
        self.records = records

    def select(self, *_): return self
    def eq(self, *_): return self
    def gte(self, *_): return self
    def order(self, *_args, **_kwargs): return self
    def limit(self, *_): return self
    def upsert(self, rows, **_kwargs):
        self.upserted = rows
        return self
    def execute(self):
        class Result:
            data = self.records
        return Result()


class Client:
    def __init__(self):
        self.tables = {
            "older_adult_profiles": Query([{"id": 7, "mobility_notes": "Seated only"}]),
            "activities": Query([activity(), activity(id=2, name="Heavy Hike", intensity="vigorous", cost=20)]),
            "activity_recommendations": Query([]),
        }

    def table(self, name):
        return self.tables[name]


def test_recommendations_persist_rows_and_exclude_over_budget():
    client = Client()
    result = recommend_activities(client, 7, interest="music", max_cost=10, limit=20)
    assert len(result) == 1
    assert result[0]["activity"]["id"] == 1
    assert len(client.tables["activity_recommendations"].upserted) == 1
