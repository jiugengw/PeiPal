from src.services.activity_search.repository import ActivityRepository


def test_repository_upserts_normalized_rows():
    calls = []

    class Table:
        def upsert(self, rows, on_conflict):
            calls.append((rows, on_conflict))
            return self

        def execute(self):
            return type("Result", (), {"data": []})()

    class Client:
        def table(self, name):
            assert name == "activities"
            return Table()

    repository = ActivityRepository(Client())
    count = repository.upsert_activities([{"dedupe_key": "event-1", "name": "Event"}])

    assert count == 1
    assert calls[0][1] == "dedupe_key"
