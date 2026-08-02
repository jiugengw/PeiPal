"""Run Count Me In as a local microphone-to-speaker voice companion."""

from __future__ import annotations

import asyncio
from collections import deque
import os
from pathlib import Path
import sys
from threading import Lock
from typing import Any

from dotenv import load_dotenv

try:
    import sounddevice as sd
except ImportError:  # pragma: no cover - exercised by the startup instructions.
    sd = None

from src.agents.count_me_in_voice import (
    AUDIO_CHANNELS,
    AUDIO_DTYPE,
    AUDIO_SAMPLE_RATE,
    build_companion_runner,
)

MICROPHONE_QUEUE_SIZE = 24
MICROPHONE_BLOCK_SIZE = 2_400


class AudioPlaybackBuffer:
    """A thread-safe PCM buffer consumed by sounddevice's output callback."""

    def __init__(self) -> None:
        self._chunks: deque[bytes] = deque()
        self._offset = 0
        self._lock = Lock()

    def push(self, audio: bytes) -> None:
        if not audio:
            return
        with self._lock:
            self._chunks.append(audio)

    def clear(self) -> None:
        with self._lock:
            self._chunks.clear()
            self._offset = 0

    def read(self, byte_count: int) -> bytes:
        """Return exactly ``byte_count`` bytes, padding silence when necessary."""

        remaining = byte_count
        output = bytearray()

        with self._lock:
            while remaining and self._chunks:
                chunk = self._chunks[0]
                available = len(chunk) - self._offset
                take = min(available, remaining)
                output.extend(chunk[self._offset : self._offset + take])
                self._offset += take
                remaining -= take

                if self._offset == len(chunk):
                    self._chunks.popleft()
                    self._offset = 0

        if remaining:
            output.extend(b"\x00" * remaining)
        return bytes(output)


def get_api_key() -> str | None:
    """Load a local .env file and return the API key without printing it."""

    load_dotenv(dotenv_path=Path.cwd() / ".env")
    return os.environ.get("OPENAI_API_KEY") or None


def transcript_line(item: Any) -> str | None:
    """Format a completed user or assistant history item for terminal display."""

    role = getattr(item, "role", None)
    if role not in {"user", "assistant"}:
        return None

    parts: list[str] = []
    for content in getattr(item, "content", []):
        text = getattr(content, "transcript", None) or getattr(content, "text", None)
        if text:
            parts.append(text.strip())

    if not parts:
        return None
    speaker = "You" if role == "user" else "Count Me In"
    return f"{speaker}: {' '.join(parts)}"


def enqueue_latest(audio_queue: asyncio.Queue[bytes], audio: bytes) -> None:
    """Keep microphone capture responsive when the network temporarily slows."""

    if audio_queue.full():
        try:
            audio_queue.get_nowait()
        except asyncio.QueueEmpty:
            pass
    try:
        audio_queue.put_nowait(audio)
    except asyncio.QueueFull:
        pass


async def send_microphone_audio(session: Any, audio_queue: asyncio.Queue[bytes]) -> None:
    """Forward microphone chunks to the active Realtime session."""

    while True:
        await session.send_audio(await audio_queue.get())


async def consume_session_events(session: Any, playback: AudioPlaybackBuffer) -> None:
    """Play model audio, display transcripts, and stop speech on interruption."""

    async for event in session:
        if event.type == "audio":
            playback.push(event.audio.data)
        elif event.type == "audio_interrupted":
            playback.clear()
        elif event.type == "history_added":
            line = transcript_line(event.item)
            if line:
                print(line, flush=True)
        elif event.type == "error":
            print(f"OpenAI Realtime error: {event.error}", file=sys.stderr, flush=True)


async def run_voice_demo() -> int:
    """Start the local voice session and return a shell-compatible exit code."""

    if sd is None:
        print(
            "The audio dependency is missing. Activate the virtual environment and run "
            "pip install -r requirements.txt.",
            file=sys.stderr,
        )
        return 2

    if not get_api_key():
        print(
            "OPENAI_API_KEY is not set. Export it in this terminal before starting the demo.",
            file=sys.stderr,
        )
        return 2

    runner = build_companion_runner()
    playback = AudioPlaybackBuffer()
    audio_queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=MICROPHONE_QUEUE_SIZE)
    loop = asyncio.get_running_loop()

    def input_callback(indata: Any, _frames: int, _time: Any, status: Any) -> None:
        if status:
            print(f"Microphone status: {status}", file=sys.stderr, flush=True)
        loop.call_soon_threadsafe(enqueue_latest, audio_queue, bytes(indata))

    def output_callback(outdata: Any, _frames: int, _time: Any, status: Any) -> None:
        if status:
            print(f"Speaker status: {status}", file=sys.stderr, flush=True)
        outdata[:] = playback.read(len(outdata))

    try:
        session = await runner.run()
        async with session:
            with sd.RawInputStream(
                samplerate=AUDIO_SAMPLE_RATE,
                blocksize=MICROPHONE_BLOCK_SIZE,
                channels=AUDIO_CHANNELS,
                dtype=AUDIO_DTYPE,
                callback=input_callback,
            ), sd.RawOutputStream(
                samplerate=AUDIO_SAMPLE_RATE,
                channels=AUDIO_CHANNELS,
                dtype=AUDIO_DTYPE,
                callback=output_callback,
            ):
                sender = asyncio.create_task(send_microphone_audio(session, audio_queue))
                print("Listening. Speak naturally; press Ctrl+C to stop.", flush=True)
                try:
                    await consume_session_events(session, playback)
                finally:
                    sender.cancel()
                    await asyncio.gather(sender, return_exceptions=True)
    except KeyboardInterrupt:
        print("\nVoice demo stopped.", flush=True)
        return 0
    except Exception as error:
        print(f"Unable to start the voice demo: {error}", file=sys.stderr, flush=True)
        print(
            "Check your API key, internet connection, microphone permission, and speaker device.",
            file=sys.stderr,
            flush=True,
        )
        return 1

    return 0


def main() -> None:
    """Run the asynchronous CLI and propagate its exit status."""

    raise SystemExit(asyncio.run(run_voice_demo()))


if __name__ == "__main__":
    main()
