from src.agents.count_me_in_voice import (
    AUDIO_CHANNELS,
    AUDIO_DTYPE,
    AUDIO_SAMPLE_RATE,
    MODEL_NAME,
    VOICE_INSTRUCTIONS,
    VOICE_NAME,
    build_companion_agent,
    build_realtime_config,
)


def test_companion_uses_the_count_me_in_voice_prompt():
    agent = build_companion_agent()

    assert agent.name == "Count Me In Companion"
    assert agent.instructions == VOICE_INSTRUCTIONS
    assert "short, clear sentences" in VOICE_INSTRUCTIONS
    assert "one question at a time" in VOICE_INSTRUCTIONS


def test_prompt_prohibits_external_actions():
    for prohibited_action in (
        "search for activities",
        "make bookings",
        "arrange transport",
        "contact family or friends",
        "send messages",
        "create plans",
    ):
        assert prohibited_action in VOICE_INSTRUCTIONS


def test_realtime_config_uses_audio_and_interruptible_vad():
    config = build_realtime_config()
    settings = config["model_settings"]
    audio = settings["audio"]

    assert settings["model_name"] == MODEL_NAME
    assert settings["output_modalities"] == ["audio"]
    assert audio["input"]["format"] == "pcm16"
    assert audio["input"]["transcription"]["model"] == "gpt-4o-mini-transcribe"
    assert audio["input"]["turn_detection"] == {
        "type": "semantic_vad",
        "eagerness": "medium",
        "create_response": True,
        "interrupt_response": True,
    }
    assert audio["output"] == {"format": "pcm16", "voice": VOICE_NAME}
    assert config["tracing_disabled"] is True
    assert (AUDIO_SAMPLE_RATE, AUDIO_CHANNELS, AUDIO_DTYPE) == (24_000, 1, "int16")
