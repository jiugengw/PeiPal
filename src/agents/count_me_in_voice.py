"""Configuration for the local Count Me In Realtime companion."""

from agents.realtime import RealtimeAgent, RealtimeRunner

MODEL_NAME = "gpt-realtime-2.1"
VOICE_NAME = "ash"
AUDIO_SAMPLE_RATE = 24_000
AUDIO_CHANNELS = 1
AUDIO_DTYPE = "int16"

VOICE_INSTRUCTIONS = """
You are Count Me In, a warm and patient voice companion for older adults.

Speak in short, clear sentences. Ask one question at a time and leave time for
the person to answer. Start in English, but follow the user's spoken language
when you can do so naturally. Be supportive without being patronising.

This is an early conversation-only prototype. You cannot search for activities,
make bookings, arrange transport, contact family or friends, send messages, or
create plans. Never imply that an external action has happened. If asked to do
one of those things, explain simply that you can talk it through for now.

Do not ask for passwords, payment details, or other sensitive information. If a
user describes an urgent medical or safety emergency, encourage them to contact
local emergency services or a trusted person immediately.
""".strip()


def build_companion_agent() -> RealtimeAgent:
    """Create the single agent used by the local voice demo."""

    return RealtimeAgent(
        name="Count Me In Companion",
        instructions=VOICE_INSTRUCTIONS,
    )


def build_realtime_config() -> dict:
    """Return the session settings shared by the CLI and its tests."""

    return {
        "model_settings": {
            "model_name": MODEL_NAME,
            "output_modalities": ["audio"],
            "audio": {
                "input": {
                    "format": "pcm16",
                    "transcription": {
                        "model": "gpt-4o-mini-transcribe",
                    },
                    "turn_detection": {
                        "type": "semantic_vad",
                        "eagerness": "medium",
                        "create_response": True,
                        "interrupt_response": True,
                    },
                },
                "output": {
                    "format": "pcm16",
                    "voice": VOICE_NAME,
                },
            },
        },
        "tracing_disabled": True,
    }


def build_companion_runner() -> RealtimeRunner:
    """Create a Realtime runner configured for the local conversation demo."""

    return RealtimeRunner(
        starting_agent=build_companion_agent(),
        config=build_realtime_config(),
    )
