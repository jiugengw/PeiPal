"""Run the same Count Me In agent through a typed terminal chat."""

from __future__ import annotations

import asyncio
import sys
from typing import Any

from src.agents.count_me_in_voice import build_text_runner
from src.demo.voice_cli import get_api_key, transcript_line


EXIT_COMMANDS = {"/exit", "/quit", "exit", "quit"}


def assistant_transcript(item: Any) -> str | None:
    """Return only assistant text so the typed user input is not duplicated."""

    if getattr(item, "role", None) != "assistant":
        return None
    return transcript_line(item)


async def receive_response(session: Any) -> None:
    """Consume one response, including any tool calls, until it completes."""

    latest_assistant_line: str | None = None

    async for event in session:
        if event.type == "history_added":
            line = assistant_transcript(event.item)
            if line:
                latest_assistant_line = line
        elif event.type == "history_updated":
            for item in reversed(event.history):
                line = assistant_transcript(item)
                if line:
                    latest_assistant_line = line
                    break
        elif event.type == "agent_end":
            if latest_assistant_line:
                print(latest_assistant_line, flush=True)
            return
        elif event.type == "error":
            print(f"OpenAI Realtime error: {event.error}", file=sys.stderr, flush=True)
            return


async def run_chat_demo() -> int:
    """Start a text conversation using the same agent and tools as voice mode."""

    if not get_api_key():
        print(
            "OPENAI_API_KEY is not set. Add it to .env before starting the chat.",
            file=sys.stderr,
        )
        return 2

    runner = build_text_runner()
    try:
        session = await runner.run()
        async with session:
            print("Count Me In chat. Type /exit to stop.", flush=True)
            while True:
                try:
                    message = await asyncio.to_thread(input, "You: ")
                except EOFError:
                    print("\nChat stopped.", flush=True)
                    return 0

                message = message.strip()
                if not message:
                    continue
                if message.lower() in EXIT_COMMANDS:
                    print("Chat stopped.", flush=True)
                    return 0

                await session.send_message(message)
                await receive_response(session)
    except KeyboardInterrupt:
        print("\nChat stopped.", flush=True)
        return 0
    except Exception as error:
        print(f"Unable to start the chat: {error}", file=sys.stderr, flush=True)
        print("Check your API key, internet connection, and Realtime access.", file=sys.stderr)
        return 1


def main() -> None:
    """Run the asynchronous chat CLI and propagate its exit status."""

    raise SystemExit(asyncio.run(run_chat_demo()))


if __name__ == "__main__":
    main()
