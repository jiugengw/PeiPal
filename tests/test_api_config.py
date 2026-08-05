from src.api.config import cors_origins, parallel_api_key


def test_cors_origins_are_read_from_environment(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://example.com, http://localhost:8080")

    assert cors_origins() == ["https://example.com", "http://localhost:8080"]


def test_parallel_api_key_is_read_from_environment(monkeypatch):
    monkeypatch.setenv("PARALLEL_API_KEY", "parallel-test-key")

    assert parallel_api_key() == "parallel-test-key"
