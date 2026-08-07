from src.agents.peipal_voice import (
    AUDIO_CHANNELS,
    AUDIO_DTYPE,
    AUDIO_SAMPLE_RATE,
    MODEL_NAME,
    VOICE_INSTRUCTIONS,
    VOICE_NAME,
    build_companion_agent,
    build_realtime_config,
    build_text_runner,
)


def test_companion_uses_the_peipal_voice_prompt():
    """Keep the agent identity and elderly-friendly conversation rules intact."""

    agent = build_companion_agent()

    assert agent.name == "PeiPal Companion"
    assert agent.instructions == VOICE_INSTRUCTIONS
    assert "short, clear sentences" in VOICE_INSTRUCTIONS
    assert "one question at a time" in VOICE_INSTRUCTIONS


def test_prompt_prohibits_external_actions():
    """Prevent the demo from claiming that real-world actions were completed."""

    for prohibited_action in (
        "make bookings",
        "arrange transport",
        "contact family or friends",
        "send other messages",
    ):
        assert prohibited_action in VOICE_INSTRUCTIONS


def test_agent_exposes_recommendation_and_email_tools():
    """Ensure the shared agent exposes the complete invitation workflow."""

    agent = build_companion_agent()

    assert [tool.name for tool in agent.tools] == [
        "recommend_activities",
        "list_family_members",
        "prepare_invitation_email",
        "send_invitation_email",
    ]


def test_realtime_config_uses_audio_and_turn_detection():
    """Verify the voice session uses the expected model, audio format, and VAD."""

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
        "interrupt_response": False,
    }
    assert audio["output"] == {"format": "pcm16", "voice": VOICE_NAME}
    assert config["tracing_disabled"] is True
    assert (AUDIO_SAMPLE_RATE, AUDIO_CHANNELS, AUDIO_DTYPE) == (24_000, 1, "int16")


def test_text_runner_uses_the_same_agent_with_text_output():
    """Verify chat mode reuses the same agent and tools while requesting text output."""

    build_text_runner()
    agent = build_companion_agent()
    config = build_realtime_config(["text"])

    assert agent.name == "PeiPal Companion"
    assert config["model_settings"]["output_modalities"] == ["text"]
    assert [tool.name for tool in agent.tools] == [
        "recommend_activities",
        "list_family_members",
        "prepare_invitation_email",
        "send_invitation_email",
    ]


def test_prompt_requires_preview_and_separate_confirmation():
    assert "read the recipient names, subject, and full message" in VOICE_INSTRUCTIONS
    assert "new, explicit confirmation" in VOICE_INSTRUCTIONS
