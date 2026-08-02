# Count Me In
Count Me In is a voice-first companion agent that helps older adults find nearby activities and share their interest with trusted family or friends. Instead of making direct invitations, it creates low-pressure plans others can support by joining, reminding, arranging transport, or suggesting alternatives.

## Local voice demo

The first voice prototype runs locally from the terminal. It uses the computer's
default microphone and speakers, and it does not save transcripts or perform any
external actions.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and replace the placeholder with your real API key.
python -m src.demo.voice_cli
```

The CLI automatically reads `OPENAI_API_KEY` from `.env`. The file is excluded
from Git, so keep your real key there and never commit or share it. On macOS,
grant your terminal microphone permission when prompted. Press `Ctrl+C` to stop
the demo.

### Manual acceptance guide

1. Activate the virtual environment and set `OPENAI_API_KEY` as shown above.
2. Start `python -m src.demo.voice_cli`.
3. Confirm that the terminal says `Listening` and allow microphone access if
   macOS asks.
4. Say something like, “I want to do something relaxing this weekend.” The
   companion should ask for the information it needs.
5. Answer with a location, timing, activity style, and mobility preference. The
   mock recommender should return three activities and the companion should
   describe them aloud.
6. Choose one activity and confirm that you want to share it. The companion
   should create and read a draft support message; it must not send anything.
7. Start speaking while the companion is replying. Its queued audio should stop
   so it can listen to the new turn.
8. Press `Ctrl+C` and confirm that the process exits cleanly.

### Troubleshooting

- **`OPENAI_API_KEY is not set`**: copy `.env.example` to `.env`, then add the
  key after the equals sign. Never add a real key to `.env.example` or commit it.
- **No microphone input on macOS**: open **System Settings → Privacy & Security
  → Microphone**, then enable the terminal app you used to launch Python.
- **No speaker output or an audio-device error**: select a working default input
  and output device in macOS Sound settings, then restart the demo.
- **Connection error**: confirm that the API key, network connection, and
  Realtime model access are available for your OpenAI project.

### Current limitations

This release is local-only and has no browser interface. It prints transcripts
to the terminal for the active session but does not save them. Activity results
and invitation drafts are mock data for the demo. No message is sent, and the
prototype cannot contact trusted people, arrange transport, or make bookings.

### OpenAI documentation used

- [Realtime Agents Quickstart — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/quickstart/)
- [Realtime Agents Guide — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/guide/)
- [Realtime Transport — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/transport/)
- [Voice agents — OpenAI API](https://developers.openai.com/api/docs/guides/voice-agents)
