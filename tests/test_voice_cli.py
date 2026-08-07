import asyncio
from types import SimpleNamespace

from src.demo.voice_cli import AudioPlaybackBuffer, enqueue_latest, get_api_key, transcript_line
from src.demo.chat_cli import assistant_transcript, receive_response


def test_playback_buffer_preserves_audio_order_and_pads_silence():
    """Ensure speaker playback receives ordered bytes and silence when underfilled."""

    playback = AudioPlaybackBuffer()
    playback.push(b"abc")
    playback.push(b"de")

    assert playback.read(4) == b"abcd"
    assert playback.read(3) == b"e\x00\x00"


def test_playback_buffer_clear_stops_pending_audio():
    """Ensure an interruption can remove audio still waiting in the speaker buffer."""

    playback = AudioPlaybackBuffer()
    playback.push(b"pending")
    playback.clear()

    assert playback.read(7) == b"\x00" * 7


def test_enqueue_latest_discards_old_audio_when_full():
    """Keep microphone capture responsive by dropping stale chunks under pressure."""

    queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=2)
    queue.put_nowait(b"oldest")
    queue.put_nowait(b"newer")

    enqueue_latest(queue, b"latest")

    assert queue.get_nowait() == b"newer"
    assert queue.get_nowait() == b"latest"


def test_transcript_line_uses_audio_transcripts_and_text():
    """Format both transcribed speech and text content for terminal display."""

    user_item = SimpleNamespace(
        role="user",
        content=[SimpleNamespace(transcript="Hello there")],
    )
    assistant_item = SimpleNamespace(
        role="assistant",
        content=[SimpleNamespace(text="How can I help?")],
    )

    assert transcript_line(user_item) == "You: Hello there"
    assert transcript_line(assistant_item) == "PeiPal: How can I help?"


def test_transcript_line_ignores_non_message_items():
    """Avoid printing tool or other non-conversation items as user dialogue."""

    item = SimpleNamespace(role="tool", content=[SimpleNamespace(text="ignored")])

    assert transcript_line(item) is None


def test_get_api_key_reads_the_environment(monkeypatch, tmp_path):
    """Load keys from the environment while keeping tests isolated from real .env files."""

    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert get_api_key() is None

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    assert get_api_key() == "test-key"


def test_chat_only_displays_assistant_transcripts():
    """Prevent typed user messages from being printed twice in chat mode."""

    user_item = SimpleNamespace(role="user", content=[SimpleNamespace(text="hello")])
    assistant_item = SimpleNamespace(
        role="assistant", content=[SimpleNamespace(text="Hi there")]
    )

    assert assistant_transcript(user_item) is None
    assert assistant_transcript(assistant_item) == "PeiPal: Hi there"


def test_chat_prints_final_text_from_history_update(capsys):
    """Protect the chat fix for assistant text delivered through history updates."""

    assistant_item = SimpleNamespace(
        role="assistant", content=[SimpleNamespace(text="I can help with that.")]
    )

    class FakeSession:
        def __aiter__(self):
            async def events():
                yield SimpleNamespace(type="history_updated", history=[assistant_item])
                yield SimpleNamespace(type="agent_end")

            return events()

    asyncio.run(receive_response(FakeSession()))

    assert capsys.readouterr().out == "PeiPal: I can help with that.\n"
