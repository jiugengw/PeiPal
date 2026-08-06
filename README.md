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

#### API documentation

FastAPI publishes interactive documentation automatically:

```text
http://127.0.0.1:8000/docs       Swagger UI
http://127.0.0.1:8000/redoc      ReDoc
http://127.0.0.1:8000/openapi.json  OpenAPI schema
```

The docs are grouped in the intended workflow order:

1. **System** — health checks.
2. **Activities** — find active activities.
3. **Households** — create and manage a family household.
4. **Older adults** — save practical profile details.
5. **Trusted contacts** — manage people who can help.
6. **Plans** — create and update a plan's lifecycle status.
7. **Support offers** — offer or withdraw practical help.

When adding a new endpoint, keep it in the matching tag group and provide a
short `summary` in the route decorator. Use the workflow order above when
adding new groups so the generated docs remain easy to follow.

The static website requests saved activities from `/api/activities` when the
backend is running. If the API is unavailable, it keeps the demo activities so
the prototype remains usable offline.

The authenticated API also supports the core planning workflow. A signed-in
household member can create and retrieve household setup data, update the
older-adult profile and trusted contacts, choose direct or family-approved
sharing, update the plan status when needed, and add or withdraw support offers.
Plans and support offers are stored in Supabase. The current API does not yet
send notifications or connect these workflow endpoints to the React screens.

### React frontend

The production frontend foundation lives in `frontend/` and uses React,
TypeScript, Vite, React Router, Tailwind CSS, Vitest, and Testing Library.

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

During development, Vite proxies `/api` and `/health` to the FastAPI server at
`http://127.0.0.1:8000`. Copy `.env.example` to `.env` only when you need to
override that API URL or add future public Supabase browser credentials.

The frontend API types are generated from FastAPI's OpenAPI document. After
changing an API path, parameter, request model, or response model, keep the
backend running and regenerate the declarations:

```powershell
cd frontend
npm.cmd run generate:api
```

Application code should use the typed client in `src/lib/fetchClient.ts`
instead of declaring duplicate transport types or calling `fetch` directly.

### Refreshing activities with Parallel

The backend can use Parallel Search and Extract to discover current activities
and save them into Supabase. Add a server-side `PARALLEL_API_KEY` to `.env`,
then run a refresh manually:

```bash
python scripts/refresh_activities.py \
  --area Bishan \
  --start-date 2026-08-05 \
  --end-date 2026-09-05 \
  --timing Morning \
  --preference Talk \
  --mobility "Gentle, no steps"
```

The command logs its search criteria, extracts official result pages, skips
results without a usable event date/time, upserts the remaining activities,
and expires activities that have already started. The Parallel key stays in
the backend process and is never sent to the website.

For an offline fixture refresh, use:

```bash
python scripts/refresh_activities.py --provider json --input data/sample_activities.json
```

### Evaluating Parallel search and extraction

Capture real search and extraction results without connecting to Supabase:

```bash
python scripts/capture_activity_eval.py \
  --area Bishan \
  --start-date 2026-08-05 \
  --end-date 2026-09-05 \
  --preference "fun and educational"
```

This produces `unlabelled.jsonl` for WorkBuddy and a separate
`predictions.jsonl`. Keep the predictions hidden while WorkBuddy labels the raw
cases using `evals/activity_extraction/label_schema.json`; this avoids anchoring
the evaluator to the current parser. WorkBuddy should write reviewed labels to
`evals/activity_extraction/gold_cases.jsonl`.

Compare the reviewed labels with the system predictions:

```bash
python scripts/evaluate_activity_extraction.py \
  --cases evals/activity_extraction/gold_cases.jsonl \
  --predictions evals/activity_extraction/predictions.jsonl
```

The evaluator reports event and recommendation precision/recall, usable-event
rate, field accuracy, and clickable failures in JSON and Markdown. Use
`--append` on the capture command to build a larger deduplicated test set across
multiple areas and preferences.

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
