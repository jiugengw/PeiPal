# Frontend Implementation Plan — Count Me In

## Summary

Build a judge-ready React experience where one authenticated household owner can:

1. Set up a household and older-adult profile.
2. Add trusted contacts and choose a sharing mode.
3. Discover activities using clicks, text, or live voice.
4. Create and confirm a plan.
5. Approve the plan when family approval is required.
6. Share it and email selected trusted contacts.
7. Switch into a clearly labelled demo family view.
8. Offer or withdraw practical support.

Clicks, typed messages, and voice must operate on the same application state and call the same backend service functions.

## Backend Readiness Gate

The frontend should begin core REST work immediately, but full integration is ready only after these conditions are met:

- Merge `feat/browser-voice-agent` into the branch used by frontend. `main` currently does not contain browser voice sessions or notification routes.
- Apply all Supabase migrations, including:
  - `20260806110000_older_adult_sharing_mode.sql`
  - `20260806120000_plan_notifications.sql`
- Configure backend environment values:
  - `OPENAI_API_KEY`
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
  - Supabase credentials and allowed frontend CORS origin.
- Add a reliable way to load an activity belonging to an existing plan. Preferred backend addition: `GET /api/activities/{activity_id}`. Current plan responses contain only `activity_id`, while activity listing may no longer return an expired activity.
- Regenerate `src/generated/api.d.ts` from the rebased backend. The typed client is implemented, but the committed declarations predate the additional household, profile, trusted-contact, plan, and support-offer routes now on `main`.
- Complete one live smoke test against Supabase, Resend, and OpenAI. Backend contract tests exist, but the full suite has not yet been run successfully in the current local environment.

A separate trusted-contact login is explicitly out of scope. The family view uses the same signed-in demo account because trusted contacts are not currently linked to Supabase users or household memberships.

## Application Structure

### Routes

Use this authenticated route structure:

- `/auth`
  - Existing sign-up and login experience.
  - Redirect authenticated users according to setup state.
- `/`
  - Lightweight resolver route.
  - No household → `/setup`
  - Existing household/profile → `/discover`
- `/setup`
  - Four-step setup flow.
- `/discover`
  - Main activity discovery and voice-companion experience.
- `/plans/$planId`
  - Plan review, approval, sharing, notifications, and status.
- `/family`
  - Shared plans and support offers.
  - Display "Demo family view" persistently so judges understand the same-account limitation.
- Unknown authenticated route
  - Friendly not-found page with links to discovery and family view.

### Feature organization

Organize by product feature:

- `setup`: household, older-adult profile, sharing preference, trusted contacts.
- `activities`: discovery, filtering, activity details, selection.
- `plans`: creation, lifecycle, review, notification delivery.
- `family`: shared-plan list and support offers.
- `voice`: Realtime session, transcript, tools, microphone state, approval prompts.
- `lib/fetchClient.ts`: generated OpenAPI client, TanStack Query helpers, and Supabase authentication middleware.
- `generated/api.d.ts`: generated request, response, path, and parameter types from FastAPI.

TanStack Query owns server state. Local component state should only hold temporary form input, selected activity, open dialogs, and voice connection state.

## API Client and Public Types

### Generated client foundation

The shared API foundation is implemented with `openapi-fetch` and `openapi-react-query`:

- `src/lib/fetchClient.ts` exports typed query and mutation helpers.
- Supabase bearer tokens are attached through shared request middleware.
- `src/generated/api.d.ts` is generated from FastAPI's `/openapi.json` contract.
- Feature-specific query options and mutations belong in `features/<feature>/api/`.
- After backend contract changes, run `npm.cmd run generate:api` while FastAPI is running.

Do not add duplicate transport interfaces or one-off `fetch` wrappers. Error presentation, `401` recovery, and retry behavior still need to be implemented at the application/feature level.

### Generated and frontend-only types

Use generated OpenAPI types for backend resources, request bodies, responses, parameters, sharing modes, statuses, and support types. Do not manually redefine transport types such as `Household`, `OlderAdultProfile`, `TrustedContact`, `Plan`, or `SupportOffer`.

Create a frontend-only view model only when the UI intentionally transforms generated API data. For activity presentation, preserve both the numeric database ID and deduplication key:

```ts
interface Activity {
  databaseId: number
  dedupeKey: string
  title: string
  venue: string
  startsAt: Date | null
  cost: number | null
  description: string
  tags: string[]
  infoLink: string | null
}
```

`databaseId` must be sent as `activity_id` when creating a plan. The deduplication key is only a stable React/list identity and must never be sent as the database ID.

### Query keys

Use predictable query keys:

- `['households']`
- `['olderAdults', householdId]`
- `['olderAdult', olderAdultId]`
- `['trustedContacts', olderAdultId]`
- `['activities', filters]`
- `['plans', householdId, status]`
- `['plan', planId]`
- `['supportOffers', planId]`
- `['notifications', planId]`

After each mutation, update the returned resource in cache and invalidate only directly affected lists.

## Complete User Journey

### 1. Authentication and entry

After Supabase authentication:

1. Request `GET /api/households`.
2. While checking, show a full-page loading state.
3. If none exist, redirect to `/setup`.
4. If one exists, store its ID in application context and continue to `/discover`.
5. If multiple exist, use the first household for the hackathon and expose a small household selector only if time permits.
6. On `401`, clear stale auth state and return to `/auth`.
7. On backend failure, show a retry action without logging the user out.

### 2. Setup flow

Use a step-based flow with visible progress and saved-server-state confirmation.

#### Step 1: Household

Fields:

- Household name, required, maximum 120 characters.

Action:

- `POST /api/households`
- Save returned `household.id`.
- Continue only after a successful response.

#### Step 2: Older-adult profile

Fields:

- Full name, required.
- Preferred name.
- Age.
- Preferred language.
- Mobility notes.
- Transport notes.

Keep mobility and transport wording practical and optional. Avoid medical framing.

Action:

- `POST /api/older-adults`
- Save returned `olderAdult.id`.

#### Step 3: Sharing preference

Offer two plainly explained choices:

- `family_approval`
  - "A family member reviews the plan before it is shared."
  - Recommended and selected by default.
- `direct`
  - "Plans are shared immediately after you confirm them."

The selection is submitted as part of the older-adult profile. If edited later, use `PATCH /api/older-adults/{id}`.

#### Step 4: Trusted circle

Allow one to five contacts for the demo.

Each contact contains:

- Name.
- Relationship.
- Email.
- Optional phone.

Email should be strongly encouraged because plan notification delivery requires it. A contact without email may still be stored, but the UI must explain that email notifications cannot be sent to that person.

Actions:

- Add: `POST /api/trusted-contacts`
- Edit: `PATCH /api/trusted-contacts/{id}`
- Remove: `DELETE /api/trusted-contacts/{id}` after confirmation.

Finish with a review summary and "Start discovering activities."

### 3. Activity discovery

The discovery page is the primary product experience.

Layout:

- Main reading column with the current conversational prompt.
- Activity results as a ruled list, not a dense card dashboard.
- Persistent voice control near the primary interaction.
- Typed fallback input beside or below voice controls.
- Selected activity shown in a focused detail surface.

Initial request:

- `GET /api/activities?limit=6`
- Optional location filter.
- Show date, time, venue, cost, description, and relevant tags.
- Use "Price unavailable" instead of treating missing cost as free.
- Use "Time to be confirmed" when `start_at` is absent.
- External information links open safely in a new tab.

Activity actions:

- "Tell me more" expands details without mutating state.
- "Choose this activity" sets the shared selected activity.
- "Make a plan" opens the confirmation stage.
- Voice selection must update the same visible selection used by clicks.

States:

- Loading skeleton matching the activity list structure.
- Empty state with a location-clear action.
- Network error with retry.
- Activity becomes unavailable before plan creation: explain and return to discovery.
- No selected activity: plan action remains disabled.

### 4. Plan creation and confirmation

Before creating a plan, show a readable summary:

- Older adult.
- Activity.
- Date and venue.
- Current sharing mode.
- What will happen next.
- Confirmation that nothing beyond the described action will occur.

On confirmation:

```http
POST /api/plans
{
  "household_id": number,
  "older_adult_id": number,
  "activity_id": activity.databaseId
}
```

Handle the returned status rather than assuming it.

#### `family_approval`

Expected lifecycle:

```text
draft → awaiting_approval → shared
```

Flow:

1. Plan creation returns `draft`.
2. User chooses "Ask for family approval."
3. Send `PATCH /api/plans/{id}` with `awaiting_approval`.
4. Show the plan in the family view under "Needs approval."
5. In demo family view, show "Approve and share."
6. After explicit approval, send `PATCH` with `shared`.
7. Continue to notification recipient selection.

Do not show a "Reject" action because rejection is not part of the agreed product model. Provide "Cancel plan," which transitions the plan to `cancelled`.

#### `direct`

Plan creation should return `shared`.

Flow:

1. Explain that the plan has been shared according to the saved preference.
2. Continue to trusted-contact notification selection.
3. Do not call the shared transition again.

#### Status labels

Use human-facing labels:

- `draft` → "Draft"
- `awaiting_approval` → "Waiting for family approval"
- `shared` → "Shared with your trusted circle"
- `cancelled` → "Cancelled"

Never expose raw status constants in UI copy.

### 5. Trusted-contact notifications

Notifications happen only after a plan is `shared`.

Flow:

1. Load trusted contacts.
2. Present contacts as checkboxes with name, relationship, and email readiness.
3. Disable contacts without email and explain why.
4. Require at least one selected contact.
5. Show a final confirmation such as:
   - "Send this plan to Anna and David?"
6. Call `POST /api/plans/{planId}/notifications` with `contact_ids`.
7. Render delivery results individually:
   - `sent` → "Email sent"
   - `already_sent` → "Already sent"
   - `failed` → "Could not send"
8. A failed delivery does not undo sharing.
9. Offer "Retry failed emails," submitting only failed contact IDs.
10. Load persistent history from `GET /api/plans/{planId}/notifications`.

Never show a global success message if some recipients failed.

### 6. Demo family view

The `/family` route uses the same authenticated owner account and includes a visible "Demo family view" marker.

Sections:

- Needs approval: `awaiting_approval` plans.
- Shared plans: `shared` plans.
- Past plans: `cancelled` plans, visually de-emphasized.

Each plan row shows:

- Older adult's preferred name.
- Activity name and essential details.
- Status in plain language.
- Notification state.
- Existing support offers.
- One obvious next action.

Approval actions:

- "Approve and share" for `awaiting_approval`.
- "Cancel plan" as the alternative.
- Require confirmation before either mutation.

This view must not imply that an actual trusted contact has authenticated. Copy should use "Preview how family can respond" rather than claiming a specific recipient is logged in.

### 7. Support offers

Support is available only on a shared plan.

Offer choices:

- `join` → "Go together"
- `remind` → "Send a reminder"
- `transport` → "Help with transport"
- `alternative` → "Suggest another option"
- `booking` → "Help with booking"
- `encourage` → "Send encouragement"

Interaction:

1. Choose one support type.
2. Add an optional note.
3. Confirm with "Offer this help."
4. Submit `POST /api/plans/{id}/support-offers`.
5. Refresh the plan's offers.
6. Disable an offer type already offered by the current account.
7. Allow withdrawal of the current account"s offer through `DELETE /api/support-offers/{offerId}` with confirmation.

Because the demo has one authenticated identity, describe offers as "You offered"" and do not fabricate different supporter names.

## Browser Voice Experience

### Technical approach

Install `@openai/agents` and Zod v4. Use `RealtimeAgent` and `RealtimeSession` in the browser. The backend mints a short-lived credential through `POST /api/voice/session`; the browser passes that credential to the session and connects over WebRTC. This keeps the permanent OpenAI key out of frontend code and lets the SDK manage browser microphone input and audio playback. [OpenAI Voice Agents quickstart](https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/) and [Realtime transport guidance](https://openai.github.io/openai-agents-js/guides/voice-agents/transport/).

Do not place an OpenAI API key in any `VITE_` environment variable.

### Voice lifecycle

Voice must never start automatically.

States:

```text
idle
→ requesting_microphone
→ connecting
→ listening
↔ thinking
↔ speaking
→ disconnected
```

Exceptional states:

- Microphone denied.
- Voice backend unavailable.
- Realtime connection failed.
- Session expired.
- Tool awaiting approval.
- Tool failed.

Controls:

- "Start voice"
- Mute/unmute microphone.
- Interrupt/stop assistant speech.
- End voice session.
- Typed message fallback.
- Visible live transcript.
- Connection/status text announced through an ARIA live region.

Ending the component, logging out, or navigating away must close the session and release microphone tracks.

### Voice tools

Browser-side tools call the same typed service functions used by click handlers. Browser tools are appropriate here because function tools execute wherever the Realtime session runs; sensitive work must still be forwarded to authenticated backend endpoints. [OpenAI voice-agent tool guidance](https://openai.github.io/openai-agents-js/guides/voice-agents/build/).

Expose these tools:

- `find_activities`
  - Inputs: optional location and limit.
  - Calls the activity query.
  - Updates visible results.
- `select_activity`
  - Input: numeric `activityId`.
  - Validates the ID against currently loaded results.
  - Updates the selected activity.
- `create_plan`
  - Uses selected activity and current profile.
  - Requires human approval.
- `request_plan_approval`
  - Valid only for a draft family-approval plan.
  - Requires human approval.
- `share_plan`
  - Valid only for an awaiting-approval plan.
  - Requires human approval.
- `send_plan_notifications`
  - Inputs: selected trusted-contact IDs.
  - Valid only for shared plans.
  - Requires human approval.
- `offer_support`
  - Inputs: plan ID, support type, optional note.
  - Valid only in demo family view.
  - Requires human approval.

Use SDK approval interruptions for every mutation that creates, shares, emails, cancels, or offers support. Display a large visual confirmation panel containing the exact proposed action. Approving resumes the tool call; rejecting returns a clear explanation to the agent. OpenAI's SDK supports pausing function tools with `needsApproval` before execution. [OpenAI human-in-the-loop guidance](https://openai.github.io/openai-agents-js/guides/human-in-the-loop/).

Read-only discovery and local selection do not require approval.

### Agent behavior

The agent instructions must enforce:

- Speak warmly, briefly, and respectfully.
- Address the older adult by preferred name when available.
- Offer no more than three activities verbally at once.
- Read important date, venue, cost, and accessibility details aloud.
- Never claim that transport, booking, attendance, or a family response is guaranteed.
- Never create, share, cancel, notify, or offer support without confirmation.
- Explain whether sharing is direct or requires family approval.
- Report partial email delivery accurately.
- Ask one question at a time.
- Keep the visible UI synchronized after every tool result.
- If voice fails, direct the user to the equivalent visible button or typed input.

## Shared Action Architecture

Create a controller layer so every meaningful operation has one implementation:

```text
Click handler ─┐
Typed input ───┼─→ workflow action → API client → query cache → visible UI
Voice tool ────┘
```

Examples:

- Activity button and `select_activity` call the same `selectActivity`.
- Plan button and `create_plan` call the same `createPlan`.
- Approval button and `share_plan` call the same `sharePlan`.
- Support button and `offer_support` call the same `offerSupport`.

Do not let the voice layer directly manipulate unrelated components or duplicate REST logic.

## UX and Accessibility Requirements

- Preserve the existing calm blue/lavender visual system.
- Minimum body text near 18px on older-adult-facing screens.
- Minimum touch target of 48px; primary actions approximately 56–60px high.
- Keep one primary decision visually dominant per stage.
- Use persistent labels; placeholders are supplemental.
- Never rely on color alone for status.
- Focus the first invalid field after form validation.
- Move focus to the new page heading after route transitions.
- Confirmation dialogs must support keyboard and screen-reader use.
- Use `aria-live="polite"` for connection, transcript, save, and delivery updates.
- Use `role="alert"` for failures requiring immediate attention.
- Respect reduced-motion preferences.
- Mobile uses one column and full-width primary actions.
- Desktop may use a slim context/progress rail beside the main task.
- Preserve click and typed alternatives when microphone permission is unavailable.

## Error and Recovery Rules

- `400`: explain the invalid relationship between selected records and return to setup.
- `401`: session expired; return to login and preserve the intended destination.
- `403`: explain that the household owner must perform the action.
- `404`: mark the resource unavailable and return to the relevant list.
- `409`: refetch the plan or offers, then show the updated state.
- `422`: map validation details to form fields.
- `502/503`: show service-specific retry copy without discarding local selections.
- Offline: keep unsaved form values locally and expose retry.
- Notification failure: keep the plan shared and retry only failed recipients.
- Voice failure: disconnect cleanly while leaving all normal UI actions available.
- Prevent double submissions by disabling the active mutation control.
- Do not use optimistic updates for approval, sharing, cancellation, notifications, or support offers.

## Test Plan

### Unit and contract tests

Cover:

- Generated query and mutation configuration for each used endpoint.
- Bearer token injection through the shared client middleware.
- Regenerated contracts after backend route or schema changes.
- Activity `databaseId` preservation.
- Date and nullable-field mapping.
- Sharing-mode and status label mapping.
- Support-type label mapping.
- Query invalidation after each mutation.
- Voice tool input validation.
- Voice tools refusing invalid status transitions.

### Component tests

Cover:

- Auth redirect based on household presence.
- Every setup step, validation, back navigation, and retry.
- Trusted contact with and without email.
- Activity loading, empty, error, and selected states.
- Direct-sharing plan result.
- Family-approval lifecycle.
- Partial notification success and failed-recipient retry.
- Duplicate support offer conflict.
- Withdrawal confirmation.
- Voice permission denied and typed fallback.
- Pending voice-tool approval, approval, and rejection.
- Voice disconnection cleanup.

### End-to-end test

Add one Playwright happy-path test with mocked OpenAI transport but real frontend routing and intercepted backend contracts:

```text
sign in
→ create household
→ create older-adult profile
→ choose family approval
→ add trusted contact
→ discover and select activity
→ create draft plan
→ request approval
→ open demo family view
→ approve and share
→ send notification
→ offer transport help
→ verify final plan state
```

Add a second compact path for `direct` sharing to verify that approval is skipped.

### Manual acceptance pass

Verify on desktop and mobile:

- Complete the flow with clicks only.
- Complete discovery and plan creation using voice.
- Interrupt the speaking assistant.
- Deny microphone permission and continue by typing/clicking.
- Refresh a plan-detail URL and recover all display information.
- Simulate one failed email and retry it.
- Navigate the complete flow using keyboard only.
- Confirm no permanent OpenAI key appears in browser source, requests, storage, or environment output.

## Commit-by-Commit Delivery Plan

1. `feat: add typed frontend api client` - completed
   - Generated OpenAPI declarations, authentication-aware client, and TanStack Query helpers.

2. `test: cover frontend api contracts` - completed
   - Covers authentication middleware, typed query/path/body serialization, no-content and error responses, and activity query defaults.

3. `feat: build household setup flow` - completed
   - Household, profile, sharing mode, trusted contacts, review, and redirect logic.

4. `test: cover household setup flow` - completed
   - Validation, persistence, failure recovery, and setup routing.

5. `feat: build activity discovery` - completed
   - Activity query, filters, list/detail selection, empty states, and typed interaction.

6. `feat: add plan workflow` - completed
   - Plan creation, direct sharing, family approval, cancellation, and plan detail route.

7. `feat: add notifications and family support` - completed
   - Recipient selection, delivery results, demo family view, support offers, and withdrawal.

8. `test: cover plan and support workflow` - completed
   - Status transitions, partial delivery, retries, conflicts, and cancellations.

9. `feat: add browser voice companion` - completed
   - Realtime WebRTC session, transcript, controls, shared workflow tools, approvals, and cleanup.

10. `test: cover browser voice workflow` - completed
    - Session states, tool guards, human approval, failures, and fallback interaction.

11. `test: add core workflow browser coverage` - skipped
    - Playwright judge path and direct-sharing path.

12. `docs: explain frontend workflow` - completed
    - Environment setup, route map, API dependencies, demo limitations, test commands, and judge walkthrough.

## Acceptance Criteria

The frontend is hackathon-ready when:

- A new account can complete setup without manually copying IDs.
- Activity selection always sends the numeric database ID.
- Both sharing modes follow their correct lifecycle.
- No plan is emailed before it becomes shared.
- Failed emails are visible and retryable without duplicate successful sends.
- Support can only be offered for shared plans.
- Click, typed, and voice interactions stay synchronized.
- Every consequential voice action pauses for explicit human approval.
- Voice failure never blocks the click-based workflow.
- The family page is honestly presented as a same-account demo view.
- The complete judge path works after a browser refresh.
- Build, lint, unit tests, and end-to-end tests pass.

## Assumptions

- One household and one older-adult profile are optimized for the judge demo.
- One authenticated owner demonstrates both older-adult and family perspectives.
- Real multi-user invitations and trusted-contact authentication are deferred.
- Notifications use email only.
- Booking, transport arrangement, reminders, and attendance tracking are represented as support offers; the app does not perform those external actions.
- The existing visual identity remains in place.
- The Impeccable design sidecar is stale relative to `DESIGN.md`; refreshing it with the `document` command is optional and separate from this implementation.
