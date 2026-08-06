"""OpenAI Realtime session setup for browser clients."""

from __future__ import annotations

import hashlib
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from src.api.config import openai_api_key


REALTIME_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets"


def create_realtime_client_secret(user_identifier: str) -> dict:
    """Mint a short-lived browser credential without exposing the server key."""

    payload = {
        "session": {
            "type": "realtime",
            "model": "gpt-realtime-2.1",
            "audio": {
                "input": {
                    "turn_detection": {
                        "type": "semantic_vad",
                        "eagerness": "medium",
                        "create_response": True,
                        "interrupt_response": True,
                    },
                    "transcription": {"model": "gpt-4o-mini-transcribe"},
                },
                "output": {"voice": "ash"},
            },
        }
    }
    request = Request(
        REALTIME_CLIENT_SECRETS_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {openai_api_key()}",
            "Content-Type": "application/json",
            "OpenAI-Safety-Identifier": hashlib.sha256(
                user_identifier.encode("utf-8")
            ).hexdigest()[:32],
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError) as error:
        raise RuntimeError(f"Realtime session creation failed: {error}") from error

    client_secret = result.get("value")
    if not client_secret:
        raise RuntimeError("Realtime session response did not include a client secret.")
    return {
        "client_secret": client_secret,
        "expires_at": result.get("expires_at"),
        "session": result.get("session"),
    }
