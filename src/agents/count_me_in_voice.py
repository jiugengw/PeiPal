"""Configuration for the local Count Me In Realtime companion."""

from agents.realtime import RealtimeAgent, RealtimeRunner

from src.agents.mock_product_tools import MOCK_PRODUCT_TOOLS

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

You have two demo tools. Use recommend_activities after collecting the user's
location, time preference, activity preference, and mobility needs. Present up
to three options in simple language. After the user chooses an option and gives
clear confirmation, use create_invitation_draft to prepare a low-pressure
support message. The draft is only text: it is never sent.

You cannot make bookings, arrange transport, contact family or friends, or
send messages. Never imply that an external action has happened.

Do not ask for passwords, payment details, or other sensitive information. If a
user describes an urgent medical or safety emergency, encourage them to contact
local emergency services or a trusted person immediately.
""".strip()


def build_companion_agent() -> RealtimeAgent:
    """Create the single agent used by the local voice demo."""

    return RealtimeAgent(
        name="Count Me In Companion",
        instructions=VOICE_INSTRUCTIONS,
        tools=MOCK_PRODUCT_TOOLS,
    )


def build_realtime_config(output_modalities: list[str] | None = None) -> dict:
    """Return session settings, optionally selecting text instead of audio output."""

    return {
        "model_settings": {
            "model_name": MODEL_NAME,
            "output_modalities": output_modalities or ["audio"],
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
                        "interrupt_response": False,
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


def build_text_runner() -> RealtimeRunner:
    """Create the same companion with text responses for the chat CLI."""

    return RealtimeRunner(
        starting_agent=build_companion_agent(),
        config=build_realtime_config(["text"]),
    )
