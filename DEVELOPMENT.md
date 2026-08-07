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
APP_BASE_URL=http://127.0.0.1:5173
```

`SUPABASE_SERVICE_ROLE_KEY` is required by the backend and its tests; without it
the API cannot start and the authentication tests fail.

`APP_BASE_URL` is the origin used to build the links in verification, invitation,
and approval emails. It must be reachable by the family members who receive them,
so set it to the deployed frontend origin outside local development.

Keep browser-safe values in `frontend/.env`:

```env
VITE_API_BASE_URL=
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Never put `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, or `GMAIL_APP_PASSWORD` in the frontend environment file.
Keep `VITE_API_BASE_URL` empty for normal local development so requests use the Vite proxy. If the browser calls FastAPI directly instead, set it to `http://127.0.0.1:8000` and include the frontend origin in the backend `CORS_ORIGINS` value.

## Email notifications

The voice agent can send a confirmed invitation email through Gmail SMTP. Configure `GMAIL_ADDRESS` and `GMAIL_APP_PASSWORD`, using a Google App Password rather than the account's normal password. Two-factor authentication must be enabled on the account before an App Password can be created.

For the local voice agent, copy `contacts.example.json` to `contacts.json` and add family members. Each selected person receives a separate email after the agent previews the full message and receives explicit confirmation.

PeiPal sends three kinds of email, all through Gmail SMTP:

```text
sign-in       a magic link so an older adult signs in without a password
coordination  each family member's own link when the family is asked
result        sent through the same coordination link, which stays live
```

The authenticated API sends and inspects them through:

```text
POST /api/plans/{plan_id}/coordination   ask the family, emailing everyone
GET  /api/plans/{plan_id}/coordination   progress, history, delivery results
```

Calling the first again retries only the recipients that failed.

Every recipient gets an individual delivery record with one of these statuses:

```text
pending
sent
failed
```

Retrying skips recipients already marked `sent`, so nobody is emailed twice.
Failed deliveries stay attached to the plan and can be retried. A response never
reports a notification as successful when delivery failed: if some recipients
could not be reached the message says how many, and if none could it says so.

### Link security

Tokens are never stored in readable form.

```text
coordination token  32 random bytes, sha256 hash stored,
                    valid until 7 days after the activity,
                    revoked when the family member is removed
```

Unlike a one-time approval link, a coordination link stays usable, because family
members return to it to watch progress. A retry rotates the token, so a link in a
failed send never works.

Coordination endpoints are deliberately reachable without a session: family
members hold no account, and the token is what authorises them. Their responses
never include email addresses, phone numbers, or anything about the wider family.

Older adults sign in through Supabase magic links, so PeiPal never stores a
password for them and no credential is ever handed over.

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
4. **Families** — create a family and verify the creator's email.
5. **Older adults** — save practical profile details and sharing mode.
6. **Family members** — manage the people the family can ask for help.
7. **Plans** — create a plan, and cancel it.
8. **Coordination emails** — delivery results for every family member.
9. **Coordination** — ask the family, and track approval, signing up, and transport.

When adding an endpoint, put it in the matching tag group and provide a short `summary` in the route decorator.

## Backend workflow

The current API workflow is:

```text
Organizer signs up with email and password
→ creates the family
→ adds older adults, each with their own email
→ adds family members with a relationship per older adult
→ sends each older adult a sign-in link
→ the older adult picks an activity and confirms it
→ creating the plan emails the whole family at once
→ POST /api/plans/{id}/coordination retries anyone who could not be reached
→ the first approve or reject decides for everyone
→ anyone claims signing up or transport
→ the plan turns ready, then is marked done
```

The data model behind this is:

```text
families                    the coordinating group
family_accounts             signed-in users: the organizer, and each older adult
older_adult_profiles        the people plans are for, linked to their auth user
family_members              people to ask, reached by email, no account needed
family_member_older_adults  the relationship, one per older adult
plan_coordination           one record per plan, version guarded
plan_coordination_tasks     approval, registration, transport
plan_coordination_events    the shared history
plan_coordination_links     one reusable link per member per plan
```

Because the relationship lives on `family_member_older_adults`, one person can be
a daughter to one older adult and a sister to another.

For browser voice, the frontend first calls `POST /api/voice/session`. The API
returns a short-lived client secret; the frontend uses it to connect to the
OpenAI Realtime session over WebRTC. Voice actions and click actions then use
the same REST endpoints above.

Plan states:

```text
draft         nobody could be emailed; the plan page offers a retry
coordinating  the whole family has been emailed
ready         approved, and signing up and transport both resolved
completed     the activity happened
rejected      the first person to answer said no
cancelled     stopped by the older adult or the organizer
```

Only cancellation is a direct status change. Everything else happens through
coordination, so no single account can shortcut the family. Every task mutation
carries the version the page was showing; a change that lost a race returns 409
instead of overwriting somebody else's action.

## Supabase migrations

Apply migrations through the Supabase Dashboard SQL Editor or the Supabase CLI.

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Current migrations, in order:

```text
20260805000100_activity_and_family.sql        activities, families, older adults, family members
20260806100000_core_workflow.sql              plans
20260806110000_older_adult_sharing_mode.sql   superseded by coordination
20260806120000_plan_notifications.sql         per-recipient share delivery
20260807190000_seed_demo_activities.sql       demo catalog
20260807191000_remove_activity_ingestion.sql
20260807200000_remove_activity_scores.sql
20260807201000_activity_recommendations.sql
20260807240000_upgrade_to_family_schema.sql   one-pass upgrade, see below
20260807250000_organizer_accounts.sql         drop the verification tables
20260807260000_older_adult_sign_in.sql        link an older adult to their login
20260807270000_plan_coordination.sql          coordination tasks, links, history
```

### Upgrading a database created before the family rename

The family rename was made by **editing the original migration files in place**,
so those files now describe the end state and cannot transform a database that
already exists. A database provisioned before the rename still has `households`,
`household_members`, and `trusted_contacts`.

For that case, run one file and nothing else:

```text
20260807240000_upgrade_to_family_schema.sql
```

It renames the household tables and columns, creates `family_members` and
`family_member_older_adults`, carries existing trusted contacts across with their
relationships, repoints notification history, drops the removed activity columns,
and creates the verification, invitation, approval, and decision-delivery tables.
Every step is guarded, so it is safe on a fresh or partly migrated database, and
running it twice changes nothing the second time.

Trusted contacts with no email address are not carried across, because the family
flow reaches people only by email.

A fresh database can instead apply the files in listed order; the upgrade file
then finds nothing left to do.

From here on, create a new migration for schema changes rather than editing an
applied file, so an existing database always has a path forward.

## React frontend

The React frontend lives in `frontend/` and uses React, TypeScript, Vite, TanStack Router, Supabase, React Query, Tailwind CSS, Vitest, and Testing Library.

```bash
cd frontend
npm install
npm run dev
```

During development, Vite proxies `/api` and `/health` to `http://127.0.0.1:8000`. Run FastAPI and Vite in separate terminals. The browser app includes organizer sign-up, passwordless sign-in for older adults, family setup, activity discovery, the account-free coordination page, delivery results, the family view, and an optional browser voice companion.

### Route map

| Route | Purpose |
| --- | --- |
| `/auth` | Log in or create an account. |
| `/` | Send an authenticated account to setup or discovery. |
| `/setup` | Create the family, add older-adult profiles, send them sign-in links, and add family members. |
| `/discover` | Search activities, choose one, and create a plan. |
| `/plans/:planId` | Review plan status, request approval, send notifications, and inspect delivery history. |
| `/family` | Family view of waiting, decided, finished, and cancelled plans. |
| `/coordinate/:token` | **Public.** The page a family member opens from their email: approve, reject, or offer to help. |

Unknown authenticated routes show a recovery page. Protected routes redirect signed-out visitors to `/auth`. `/coordinate/:token` is intentionally outside the authenticated layout, because family members act without an account.

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

`pytest` needs `SUPABASE_SERVICE_ROLE_KEY` set, or the authentication tests fail
when the API cannot build its Supabase client. Any non-empty value works, since
these tests never reach the network:

```bash
SUPABASE_SERVICE_ROLE_KEY=dummy-key-for-tests pytest -q
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

The server exposes activity search, family and older-adult lookup, plan
creation, plan retrieval, and plan status updates. It cannot approve or reject a
plan: that belongs to the family member holding the emailed link. For a hosted WorkBuddy
demo, deploy the MCP server behind HTTPS and provide the HTTPS `/mcp` URL.

Suggested demo request:

> Find a gentle social activity under $10 for Mary, then prepare it for family approval.

## Manual demo walkthrough

Start FastAPI and Vite, then open `http://127.0.0.1:5173`.

### Coordination path (first decision wins)

1. Sign up as the organizer with an email and password, then create a family.
2. Add an older adult, including their own email address.
3. Add at least two family members with different email addresses you can open,
   giving each a relationship.
4. Try adding a third member reusing one of those addresses and confirm it is
   refused as already a family member.
5. Press **Send sign-in link** for the older adult, open that email, and confirm
   it signs you in without a password.
6. As the older adult, pick an activity, create the plan, and press
   **Ask my family**.
7. Confirm every family member received their own link. If Gmail SMTP is not
   configured, confirm the page says how many could not be reached rather than
   claiming everyone was told.
8. Open the first member's link and approve.
9. Open the second member's link and confirm it shows the plan as approved and
   offers help rather than another decision.
10. Claim transport from one link and mark signing up as not needed from the
    other. Confirm the plan turns **ready**.
11. Open both links again and confirm each shows the same shared state and
    history.
12. As the older adult, mark the activity **done**.
13. Repeat with a rejection and confirm the plan ends and every link says so.

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
- **Notification failed**: check `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`, and the recipient's email address. Gmail rejects a normal account password; an App Password is required. Retry the notification request for failed recipients.
- **No sign-in link arrived**: magic links are sent by Supabase, not Gmail. Check the Supabase project's email settings and the redirect URL allow-list.
- **Coordination link does not open**: confirm `APP_BASE_URL` points at an origin the recipient can reach. Links expire seven days after the activity, and a retry rotates the token so older copies stop working.
- **"Already decided" on a fresh link**: expected when another family member answered first. The first decision wins for the whole family; that link can still be used to help.

## Current technical limitations

- Family members decide through signed email links and have no accounts of their own, so the family page shows the signed-in account's view.
- Browser end-to-end automation is deferred; the complete demo path is verified manually.
- The API does not yet arrange transport or complete bookings.
- Plan completion tracking is not yet implemented.
- Notification delivery requires Gmail SMTP configuration.
- Browser voice requires microphone permission, WebRTC support, and a configured server-side OpenAI key.

## OpenAI documentation used

- [Realtime Agents Quickstart — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/quickstart/)
- [Realtime Agents Guide — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/guide/)
- [Realtime Transport — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/transport/)
- [Voice agents — OpenAI API](https://developers.openai.com/api/docs/guides/voice-agents)
