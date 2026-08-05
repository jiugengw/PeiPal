# Count Me In
Count Me In is a voice-first companion agent that helps older adults find nearby activities and share their interest with trusted family or friends. Instead of making direct invitations, it creates low-pressure plans others can support by joining, reminding, arranging transport, or suggesting alternatives.

## Local voice demo

The first voice prototype runs locally from the terminal. It uses the computer's
default microphone and speakers, and it does not save transcripts. Its only
optional external action is a confirmed email notification through Resend.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and replace the placeholder with your real API key.
python -m src.demo.voice_cli
```

To use the same agent and tools as a typed chat instead:

```bash
python -m src.demo.chat_cli
```

### Email notifications

The agent can send a simple activity invitation through Resend after showing
the complete email and receiving explicit confirmation. Copy
`contacts.example.json` to `contacts.json`, add trusted contacts, then set
`RESEND_API_KEY` and `EMAIL_FROM` in `.env`. `EMAIL_FROM` must use a domain
verified in Resend. You may also set `EMAIL_REPLY_TO` if replies should go to a
different address. The local `contacts.json` file is excluded from Git.

Each selected contact receives a separate email, so recipients never see one
another's addresses. Emails are notifications only and do not include RSVP
buttons or booking actions.

The voice and chat commands share the same agent instructions, activity
recommendation tool, and email tools. Only the input/output mode is different.
Type `/exit` to stop chat mode.

The CLI automatically reads `OPENAI_API_KEY` from `.env`. The file is excluded
from Git, so keep your real key there and never commit or share it. On macOS,
grant your terminal microphone permission when prompted. Press `Ctrl+C` to stop
the demo.

### Backend API

Install dependencies and start the website API with:

```bash
uvicorn src.api.main:app --reload
```

The health check is available at `http://127.0.0.1:8000/health`. Supabase
credentials are loaded from `.env`; keep `SUPABASE_SERVICE_ROLE_KEY` on the
server only. Set `CORS_ORIGINS` to the deployed website origin before hosting
the API.

The static website requests saved activities from `/api/activities` when the
backend is running. If the API is unavailable, it keeps the demo activities so
the prototype remains usable offline.

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
6. Choose one activity and ask to notify a trusted contact. The companion should
   read the recipients, subject, and full message, then ask for confirmation.
7. Confirm the preview and verify that one notification reaches each selected
   contact. Skip this step if Resend is not configured.
8. Start speaking while the companion is replying. Its queued audio should stop
   so it can listen to the new turn.
9. Press `Ctrl+C` and confirm that the process exits cleanly.

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
are mock data for the demo. Confirmed email notifications can be sent when
Resend is configured, but the prototype cannot arrange transport, track
invitation responses, or make bookings.

### OpenAI documentation used

- [Realtime Agents Quickstart — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/quickstart/)
- [Realtime Agents Guide — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/guide/)
- [Realtime Transport — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/transport/)
- [Voice agents — OpenAI API](https://developers.openai.com/api/docs/guides/voice-agents)
