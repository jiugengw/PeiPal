import json

import pytest

from src.services.realtime import create_realtime_client_secret


class FakeResponse:
    def __init__(self, payload):
        self.payload = json.dumps(payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return self.payload


def test_realtime_client_secret_uses_server_key_and_returns_short_lived_secret(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "server-secret")
    captured = {}

    def fake_urlopen(request, timeout):
        captured["request"] = request
        captured["timeout"] = timeout
        return FakeResponse({
            "value": "ek_test_client_secret",
            "expires_at": 123,
            "session": {"id": "sess_test"},
        })

    monkeypatch.setattr("src.services.realtime.urlopen", fake_urlopen)

    result = create_realtime_client_secret("user-123")

    assert result["client_secret"] == "ek_test_client_secret"
    assert result["expires_at"] == 123
    assert captured["timeout"] == 30
    assert captured["request"].get_header("Authorization") == "Bearer server-secret"
    assert captured["request"].get_header("Openai-safety-identifier")
    assert json.loads(captured["request"].data)["session"]["model"] == "gpt-realtime-2.1"


def test_realtime_client_secret_requires_openai_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with pytest.raises(RuntimeError, match="OPENAI_API_KEY"):
        create_realtime_client_secret("user-123")
