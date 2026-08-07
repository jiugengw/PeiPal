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
RESEND_API_KEY=...
EMAIL_FROM=...
EMAIL_REPLY_TO=...
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

Never put `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, or `RESEND_API_KEY` in the frontend environment file.
Keep `VITE_API_BASE_URL` empty for normal local development so requests use the Vite proxy. If the browser calls FastAPI directly instead, set it to `http://127.0.0.1:8000` and include the frontend origin in the backend `CORS_ORIGINS` value.

## Email notifications

The voice agent can send a confirmed invitation email through Resend. Configure `RESEND_API_KEY` and `EMAIL_FROM`; the sender domain must be verified in Resend.

For the local voice agent, copy `contacts.example.json` to `contacts.json` and add family members. Each selected person receives a separate email after the agent previews the full message and receives explicit confirmation.

PeiPal sends four kinds of email, all through Resend:

```text
verification   six-digit code confirming the family creator's address
invitation     signed link inviting one family member
approval       signed approve/reject link, sent to every family member
decision       the result, sent to every family member and the older adult
```

The authenticated API sends and inspects them through:

```text
POST /api/plans/{plan_id}/notifications           share a plan with chosen members
GET  /api/plans/{plan_id}/notifications
POST /api/plans/{plan_id}/decision-notifications  retry the decision emails
GET  /api/plans/{plan_id}/decision-notifications
```

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

### Verification and link security

Codes and tokens are never stored in readable form.

```text
verification code   six digits, sha256 hash stored, expires after 30 minutes
invitation token    32 random bytes, sha256 hash stored, expires after 7 days
approval token      32 random bytes, sha256 hash stored, expires after 7 days
```

Approval links are deliberately reachable without a session, because family
members are reached by email and need no account. The token in the link is what
authorises the decision.

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
7. **Plans** — create and update a plan lifecycle.
8. **Notifications** — send and inspect plan email delivery.
9. **Support offers** — offer or withdraw practical help.

When adding an endpoint, put it in the matching tag group and provide a short `summary` in the route decorator.

## Backend workflow

The current API workflow is:

```text
Create family with the creator's email
→ verify that email with the six-digit code
→ create one or more older-adult profiles
→ choose direct or family_approval sharing
→ add family members with a relationship per older adult
→ select an active activity
→ create a plan
→ share directly, or ask the whole family to decide
→ first approve/reject decision wins
→ tell every family member and the older adult
→ record support offers
```

The data model behind this is:

```text
families                    the coordinating group
family_accounts             signed-in users, with an owner
older_adult_profiles        the people plans are for
family_members              people to ask, reached by email, no account needed
family_member_older_adults  the relationship, one per older adult
```

Because the relationship lives on `family_member_older_adults`, one person can be
a daughter to one older adult and a sister to another.

For browser voice, the frontend first calls `POST /api/voice/session`. The API
returns a short-lived client secret; the frontend uses it to connect to the
OpenAI Realtime session over WebRTC. Voice actions and click actions then use
the same REST endpoints above.

Sharing modes:

```text
direct          plan is created as shared
family_approval plan moves draft → awaiting_approval → approved | rejected → shared
```

Plan states:

```text
draft              nothing has been sent
awaiting_approval  every family member has been emailed a decision link
approved           the first family member to answer approved it
rejected           the first family member to answer rejected it
shared             an approved plan opened up for practical support offers
cancelled          stopped by the family
```

Deciding is only possible through the emailed link. `PATCH /api/plans/{id}` with
`approved` or `rejected` is refused with 403, and the decision itself is applied
with an update guarded on `status = awaiting_approval`, so two simultaneous
clicks cannot both win.

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
20260806100000_core_workflow.sql              plans and support offers
20260806110000_older_adult_sharing_mode.sql   direct or family_approval
20260806120000_plan_notifications.sql         per-recipient share delivery
20260807190000_seed_demo_activities.sql       demo catalog
20260807191000_remove_activity_ingestion.sql
20260807200000_remove_activity_scores.sql
20260807201000_activity_recommendations.sql
20260807210000_family_email_verification.sql  codes and invitation tokens
20260807220000_family_plan_decisions.sql      approval links and decision state
20260807230000_plan_decision_notifications.sql  per-recipient decision delivery
20260807240000_upgrade_to_family_schema.sql   one-pass upgrade, see below
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

During development, Vite proxies `/api` and `/health` to `http://127.0.0.1:8000`. Run FastAPI and Vite in separate terminals. The browser app includes authentication, family setup with email verification, activity discovery, both plan-sharing modes, the account-free approval page, notification delivery status, the family view, support offers, and an optional browser voice companion.

### Route map

| Route | Purpose |
| --- | --- |
| `/auth` | Log in or create an account. |
| `/` | Send an authenticated account to setup or discovery. |
| `/setup` | Create the family, verify the creator email, add older-adult profiles, choose a sharing preference, and add family members. |
| `/discover` | Search activities, choose one, and create a plan. |
| `/plans/:planId` | Review plan status, request approval, send notifications, and inspect delivery history. |
| `/family` | Family view of waiting, decided, shared, and past plans, plus support offers. |
| `/family/decision/:token` | **Public.** The approve/reject page a family member opens from their email. |

Unknown authenticated routes show a recovery page. Protected routes redirect signed-out visitors to `/auth`. `/family/decision/:token` is intentionally outside the authenticated layout, because family members decide without an account.

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

### Family-approval path (first decision wins)

1. Log in and create a family, entering your own email address.
2. Check that email for the six-digit code and confirm the address. With Resend
   unconfigured, confirm the interface says the code could not be sent rather
   than implying it arrived.
3. Add an older adult, optionally with their own email so they hear the outcome.
4. Choose **Family reviews first**, then add at least two family members with
   different email addresses and a relationship each.
5. Try adding a third member reusing one of those addresses and confirm it is
   refused as already a family member.
6. Open discovery, choose an activity, review it, and create the plan.
7. Confirm the plan starts as a draft, then choose **Ask for family approval**.
8. Confirm every family member received an email with approve and reject links.
9. Open one member's link, approve, and confirm the result page names who
   decided and when.
10. Open a second member's link and confirm it reports the request as already
    decided rather than letting them decide again.
11. Confirm every family member, and the older adult, received the result email.
    If some could not be reached, confirm the page names them instead of
    claiming everyone was notified.
12. In the family view, share the approved plan, offer one kind of practical
    support, and verify it appears as **You offered**.
13. Refresh `/plans/{planId}` and confirm the status, activity details,
    notification history, and support state reload.

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
- **Notification failed**: check `RESEND_API_KEY`, `EMAIL_FROM`, sender-domain verification, and the recipient's email address. Retry the notification request for failed recipients.
- **No verification code arrived**: check the same Resend settings. Family creation still succeeds, and the setup page says the code could not be sent.
- **Approval link does not open**: confirm `APP_BASE_URL` points at an origin the recipient can reach. Links expire after seven days and are single use.
- **"Already decided" on a fresh link**: expected when another family member answered first. The first decision wins for the whole family.

## Current technical limitations

- Family members decide through signed email links and have no accounts of their own, so the family page shows the signed-in account's view.
- Browser end-to-end automation is deferred; the complete demo path is verified manually.
- The API does not yet arrange transport or complete bookings.
- Plan completion tracking is not yet implemented.
- Notification delivery requires Resend configuration.
- Browser voice requires microphone permission, WebRTC support, and a configured server-side OpenAI key.

## OpenAI documentation used

- [Realtime Agents Quickstart — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/quickstart/)
- [Realtime Agents Guide — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/guide/)
- [Realtime Transport — OpenAI Agents SDK for Python](https://openai.github.io/openai-agents-python/realtime/transport/)
- [Voice agents — OpenAI API](https://developers.openai.com/api/docs/guides/voice-agents)
