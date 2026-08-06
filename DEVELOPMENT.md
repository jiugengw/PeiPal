# Count Me In Development Guide

This document contains local setup, backend, frontend, API, migration, testing, activity-ingestion, and troubleshooting instructions. The product overview for judges and collaborators is in [README.md](README.md).

## Local voice demo

The voice prototype runs locally from the terminal. It uses the computer's default microphone and speakers and does not save transcripts.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add the required keys.
python -m src.demo.voice_cli
```

To use the same agent and tools as typed chat:

```bash
python -m src.demo.chat_cli
```

Type `/exit` to stop chat mode. On macOS, grant the terminal microphone permission when prompted. Press `Ctrl+C` to stop the voice demo.

## Environment files

Keep server secrets in the root `.env`:

```env
OPENAI_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
PARALLEL_API_KEY=...
RESEND_API_KEY=...
EMAIL_FROM=...
EMAIL_REPLY_TO=...
```

Keep browser-safe values in `frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Never put `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `PARALLEL_API_KEY`, or `RESEND_API_KEY` in the frontend environment file.

## Email notifications

The voice agent can send a confirmed invitation email through Resend. Configure `RESEND_API_KEY` and `EMAIL_FROM`; the sender domain must be verified in Resend.

For the local voice agent, copy `contacts.example.json` to `contacts.json` and add trusted contacts. Each selected contact receives a separate email after the agent previews the full message and receives explicit confirmation.

The authenticated API can send plan notifications through:

```text
POST /api/plans/{plan_id}/notifications
GET  /api/plans/{plan_id}/notifications
```

Each selected trusted contact receives an individual delivery record with one of these statuses:

```text
pending
sent
failed
```

Retrying the same request skips contacts already marked `sent`. Failed deliveries remain attached to the shared plan and can be retried.

## Backend API

Start the FastAPI server from the project root:

```bash
uvicorn src.api.main:app --reload
```

Health check:

```text
http://127.0.0.1:8000/health
```

Supabase credentials are loaded from the root `.env`. Keep `SUPABASE_SERVICE_ROLE_KEY` on the server only. Set `CORS_ORIGINS` to the deployed website origin before hosting the API.

## API documentation

FastAPI publishes interactive documentation automatically:

```text
http://127.0.0.1:8000/docs          Swagger UI
http://127.0.0.1:8000/redoc         ReDoc
http://127.0.0.1:8000/openapi.json  OpenAPI schema
```

The Swagger page contains a Quick-start workflow and copyable request examples. Authorize with:

```text
Bearer YOUR_SUPABASE_ACCESS_TOKEN
```

The endpoint groups follow this order:

1. **System** — health checks.
2. **Activities** — find active activities.
3. **Voice** — create a short-lived browser voice session.
4. **Households** — create and manage a family household.
5. **Older adults** — save practical profile details and sharing mode.
6. **Trusted contacts** — manage people who can help.
7. **Plans** — create and update a plan lifecycle.
8. **Notifications** — send and inspect plan email delivery.
9. **Support offers** — offer or withdraw practical help.

When adding an endpoint, put it in the matching tag group and provide a short `summary` in the route decorator.

## Backend workflow

The current API workflow is:

```text
Create household
→ create older-adult profile
→ choose direct or family_approval sharing
→ add trusted contacts
→ select an active activity
→ create a plan
→ share directly or request owner approval
→ notify selected contacts
→ record support offers
```

For browser voice, the frontend first calls `POST /api/voice/session`. The API
returns a short-lived client secret; the frontend uses it to connect to the
OpenAI Realtime session over WebRTC. Voice actions and click actions then use
the same REST endpoints above.

Sharing modes:

```text
direct          plan is created as shared
family_approval plan moves draft → awaiting_approval → shared
```

## Supabase migrations

Apply migrations through the Supabase Dashboard SQL Editor or the Supabase CLI.

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Important current migrations:

```text
20260805000100_activity_and_family.sql
20260806100000_core_workflow.sql
20260806110000_older_adult_sharing_mode.sql
20260806120000_plan_notifications.sql
```

If a migration has already been applied, create a new migration for later schema changes instead of editing the applied file.

## React frontend

The React frontend lives in `frontend/` and uses React, TypeScript, Vite, TanStack Router, Supabase, React Query, Tailwind CSS, Vitest, and Testing Library.

```bash
cd frontend
npm install
npm run dev
```

During development, Vite proxies `/api` and `/health` to `http://127.0.0.1:8000`. The React frontend currently contains authentication, route structure, and API foundations; the complete prototype flow still needs to be connected to the React screens.

## Testing

Install Python dependencies and run:

```bash
pip install -r requirements.txt
pytest -q
```

Useful validation commands:

```bash
python3 -m compileall -q src tests
git diff --check
```

Frontend checks:

```bash
cd frontend
npm run build
npm test -- --run
```

## Refreshing activities with Parallel

The backend can use Parallel Search and Extract to discover current activities and save them into Supabase:

```bash
python scripts/refresh_activities.py \
  --area Bishan \
  --start-date 2026-08-05 \
  --end-date 2026-09-05 \
  --timing Morning \
  --preference Talk \
  --mobility "Gentle, no steps"
```

The command searches official result pages, extracts event details, skips results without usable dates or times, upserts the remaining activities, and expires activities that have already started.

For an offline fixture refresh:

```bash
python scripts/refresh_activities.py --provider json --input data/sample_activities.json
```

## Evaluating activity extraction

Capture real search and extraction results without connecting to Supabase:

```bash
python scripts/capture_activity_eval.py \
  --area Bishan \
  --start-date 2026-08-05 \
  --end-date 2026-09-05 \
  --preference "fun and educational"
```

Compare reviewed labels with predictions:

```bash
python scripts/evaluate_activity_extraction.py \
  --cases evals/activity_extraction/gold_cases.jsonl \
  --predictions evals/activity_extraction/predictions.jsonl
```

## Manual acceptance guide

1. Activate the virtual environment and configure `OPENAI_API_KEY`.
2. Start `python -m src.demo.voice_cli`.
3. Confirm that the terminal says `Listening` and allow microphone access if macOS asks.
4. Say: “I want to do something relaxing this weekend.”
5. Answer the questions about location, timing, activity style, and mobility.
6. Confirm that the companion returns up to three suitable activities.
7. Choose one and ask to notify a trusted contact.
8. Confirm the email preview and verify delivery if Resend is configured.
9. Start speaking while the companion is replying and confirm queued audio stops.
10. Press `Ctrl+C` and confirm the process exits cleanly.

## Troubleshooting

- **`OPENAI_API_KEY is not set`**: configure it in the root `.env`.
- **Missing Python module**: activate `.venv` and run `pip install -r requirements.txt`.
- **No microphone input on macOS**: enable microphone access for the terminal app in System Settings.
- **No speaker output**: select a working default input and output device, then restart the demo.
- **API connection error**: confirm the Supabase URL, service key, API keys, network connection, and CORS origin.
- **Notification failed**: check `RESEND_API_KEY`, `EMAIL_FROM`, sender-domain verification, and the contact email address. Retry the notification request for failed recipients.

## Current technical limitations

- The full React workflow is not yet connected end-to-end.
- The Python voice demo and browser product prototype use different interaction surfaces.
- The API does not yet arrange transport or complete bookings.
- Plan completion tracking is not yet implemented.
- Notification delivery requires Resend configuration.

## OpenAI documentation used

- [Realtime Agents Quickstart — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/quickstart/)
- [Realtime Agents Guide — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/guide/)
- [Realtime Transport — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/transport/)
- [Voice agents — OpenAI API](https://developers.openai.com/api/docs/guides/voice-agents)
