# PeiPal Development Guide

This document contains local setup, backend, frontend, API, migration, testing, activity-ingestion, and troubleshooting instructions. The product overview for judges and collaborators is in [README.md](README.md).

## Terminal voice demo

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
GMAIL_ADDRESS=...
GMAIL_APP_PASSWORD=...
GMAIL_FROM_NAME=PeiPal
```

Keep browser-safe values in `frontend/.env`:

```env
VITE_API_BASE_URL=
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Never put `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, or `GMAIL_APP_PASSWORD` in the frontend environment file.
Keep `VITE_API_BASE_URL` empty for normal local development so requests use the Vite proxy. If the browser calls FastAPI directly instead, set it to `http://127.0.0.1:8000` and include the frontend origin in the backend `CORS_ORIGINS` value.

## Email notifications

The voice agent and authenticated API send confirmed invitation emails through Gmail SMTP. Enable 2-Step Verification on the Gmail account, create a Google App Password, and configure `GMAIL_ADDRESS` and `GMAIL_APP_PASSWORD`. Do not use the account's normal password. `GMAIL_FROM_NAME` is optional and defaults to `PeiPal`.

Trusted contacts can use any valid recipient address; they do not need to match the Gmail sender or the account owner's email. This integration is intended for low-volume hackathon use.

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

During development, Vite proxies `/api` and `/health` to `http://127.0.0.1:8000`. Run FastAPI and Vite in separate terminals. The browser app includes authentication, household setup, activity discovery, both plan-sharing modes, notification delivery status, the demo family view, support offers, and an optional browser voice companion.

### Route map

| Route | Purpose |
| --- | --- |
| `/auth` | Log in or create an account. |
| `/` | Send an authenticated account to setup or discovery. |
| `/setup` | Create the household, older-adult profile, sharing preference, and trusted contacts. |
| `/discover` | Search activities, choose one, and create a plan. |
| `/plans/:planId` | Review plan status, request approval, send notifications, and inspect delivery history. |
| `/family` | Same-account demo family view for approval and support offers. |

Unknown authenticated routes show a recovery page. Protected routes redirect signed-out visitors to `/auth`.

### Browser voice

The voice companion starts only after the user selects **Start voice** and grants microphone access. The frontend requests a short-lived credential from `POST /api/voice/session`, then connects directly to OpenAI Realtime over WebRTC. The permanent `OPENAI_API_KEY` remains on the backend.

Voice and click interactions operate on the same visible activity and plan state. Creating, approving, sharing, notifying, and offering support always require an explicit approval in the voice panel. If microphone permission or the Realtime connection fails, every click-based form and button remains available.

### OpenAPI-generated frontend types

Frontend request and response types come from FastAPI's `/openapi.json`; do not create duplicate interfaces for backend payloads or edit `frontend/src/generated/api.d.ts` manually. After changing an API contract, start FastAPI and run:

```bash
cd frontend
npm run generate:api
```

Feature API modules use the configured client in `frontend/src/lib/fetchClient.ts`.

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
npm run lint
npm test
npm run build
```

The frontend currently uses Vitest and Testing Library. Browser-level Playwright coverage is intentionally deferred, so complete the manual demo walkthrough below before a demo.

## Demo activities

The catalog is populated by the idempotent Supabase migration
`20260807190000_seed_demo_activities.sql`, which inserts 30 varied,
future-dated activities for local demos.

```bash
supabase db reset
```

## WorkBuddy MCP server

Run the PeiPal API and MCP bridge in separate terminals:

```bash
uvicorn src.api.main:app --reload --port 8000
uvicorn src.mcp.server:app --host 0.0.0.0 --port 8001
```

Configure `PEIPAL_API_URL`, `MCP_ACCESS_TOKEN`, and `PEIPAL_API_TOKEN` in the
server environment. Connect WorkBuddy to:

```text
http://127.0.0.1:8001/mcp
```

The server exposes activity search, household and older-adult lookup, plan
creation, plan retrieval, and plan status updates. For a hosted WorkBuddy
demo, deploy the MCP server behind HTTPS and provide the HTTPS `/mcp` URL.

Suggested demo request:

> Find a gentle social activity under $10 for Mary, then prepare it for family approval.

## Manual demo walkthrough

Start FastAPI and Vite, then open `http://127.0.0.1:5173`.

### Family-approval path

1. Log in and complete setup without copying any database IDs manually.
2. Choose **Family reviews first** and add at least one trusted contact with an email address.
3. Open discovery, choose an activity, review it, and create the plan.
4. Confirm that the plan starts as a draft and choose **Ask for family approval**.
5. Open **Demo family view**, approve and share the waiting plan, then return to its detail page.
6. Select the trusted contact, review the recipient list, and send the plan email.
7. Confirm the delivery result is visible. If Gmail is not configured, confirm the failed result is honest and retryable.
8. Return to the family view, offer one kind of practical support, and verify it appears as **You offered**.
9. Refresh `/plans/{planId}` and confirm the shared status, activity details, notification history, and support state reload.

### Direct-sharing path

1. Edit or create a profile using **Share after personal confirmation**.
2. Choose an activity and confirm plan creation.
3. Confirm the plan is immediately shared and no family-approval action appears.
4. Verify notification selection is available only after the plan is shared.

### Browser voice checks

1. Open the voice companion and confirm nothing starts until **Start voice** is selected.
2. Allow microphone access, search for activities, and confirm voice and visible selection stay synchronized.
3. Trigger a consequential action and verify the approval panel appears before anything changes.
4. Test mute, stop speech, typed fallback, and ending the session.
5. Deny microphone permission once and confirm the normal click workflow still works.

## Troubleshooting

- **`OPENAI_API_KEY is not set`**: configure it in the root `.env`.
- **Missing Python module**: activate `.venv` and run `pip install -r requirements.txt`.
- **No microphone input on macOS**: enable microphone access for the terminal app in System Settings.
- **No speaker output**: select a working default input and output device, then restart the demo.
- **API connection error**: confirm the Supabase URL, service key, API keys, network connection, and CORS origin.
- **Notification failed**: check `GMAIL_ADDRESS`, the Google App Password, 2-Step Verification, and the contact email address. Retry the notification request for failed recipients.

## Current technical limitations

- The family page is a same-account demo, not a separately authenticated trusted-contact portal.
- Browser end-to-end automation is deferred; the complete demo path is verified manually.
- The API does not yet arrange transport or complete bookings.
- Plan completion tracking is not yet implemented.
- Notification delivery requires a Gmail account with 2-Step Verification and an App Password.
- Browser voice requires microphone permission, WebRTC support, and a configured server-side OpenAI key.

## OpenAI documentation used

- [Realtime Agents Quickstart — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/quickstart/)
- [Realtime Agents Guide — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/guide/)
- [Realtime Transport — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/transport/)
- [Voice agents — OpenAI API](https://developers.openai.com/api/docs/guides/voice-agents)
