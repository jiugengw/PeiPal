import asyncio
from types import SimpleNamespace

from src.demo.voice_cli import AudioPlaybackBuffer, enqueue_latest, get_api_key, transcript_line


def test_playback_buffer_preserves_audio_order_and_pads_silence():
    playback = AudioPlaybackBuffer()
    playback.push(b"abc")
    playback.push(b"de")

    assert playback.read(4) == b"abcd"
    assert playback.read(3) == b"e\x00\x00"


def test_playback_buffer_clear_stops_pending_audio():
    playback = AudioPlaybackBuffer()
    playback.push(b"pending")
    playback.clear()

    assert playback.read(7) == b"\x00" * 7


def test_enqueue_latest_discards_old_audio_when_full():
    queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=2)
    queue.put_nowait(b"oldest")
    queue.put_nowait(b"newer")

    enqueue_latest(queue, b"latest")

    assert queue.get_nowait() == b"newer"
    assert queue.get_nowait() == b"latest"


def test_transcript_line_uses_audio_transcripts_and_text():
    user_item = SimpleNamespace(
        role="user",
        content=[SimpleNamespace(transcript="Hello there")],
    )
    assistant_item = SimpleNamespace(
        role="assistant",
        content=[SimpleNamespace(text="How can I help?")],
    )

    assert transcript_line(user_item) == "You: Hello there"
    assert transcript_line(assistant_item) == "Count Me In: How can I help?"


def test_transcript_line_ignores_non_message_items():
    item = SimpleNamespace(role="tool", content=[SimpleNamespace(text="ignored")])

    assert transcript_line(item) is None


def test_get_api_key_reads_only_the_environment(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert get_api_key() is None

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    assert get_api_key() == "test-key"
