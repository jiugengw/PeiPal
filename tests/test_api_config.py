from src.api.config import cors_origins


def test_cors_origins_are_read_from_environment(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://example.com, http://localhost:8080")

    assert cors_origins() == ["https://example.com", "http://localhost:8080"]
