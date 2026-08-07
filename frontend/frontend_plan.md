 # Elderly-First Trusted-Circle Coordination

  ## Summary

  Replace the demo family experience with an elderly-only authenticated app and a public, magic-link
  coordination page for trusted contacts.

  When the elderly person selects Ask my trusted circle, PeiPal creates the three coordination tasks and emails
  every confirmed contact. Each recipient receives a unique link on the same PeiPal domain, such as:

  https://peipal.app/coordinate/<opaque-token>

  The token is exchanged for a secure HTTP-only session cookie and removed from the visible URL. Different
  tokens identify different contacts while loading the same shared plan state.

  A plan completes automatically when:

  - One trusted contact approves it.
  - Registration is completed or marked not needed.
  - Transport is completed or marked not needed.

  ## Coordination Model and APIs

  - Add one shared coordination record per plan, with approval, registration, and transport tasks.
  - Registration and transport allow one current owner. A contact can claim, release, complete, or explicitly
    take over a task.

  - Takeovers require confirmation, use optimistic concurrency, and create a visible history entry.
  - Only the current owner can complete or release their task.
  - Any active contact can mark an unassigned task as not needed.
  - Once all completion conditions are met, atomically change the plan to completed; completed plans are read-
    only.

  - Cancelling from the elderly app immediately makes every magic-link page show the cancelled state.
  - Store only hashes of 256-bit random magic-link tokens. Tokens expire seven days after the activity and are
    revoked when the contact is removed.

  - Public coordination responses expose contact display names and actions, but never emails, phone numbers,
    household data, or raw tokens.

  Add authenticated elderly endpoints:

  - POST /api/plans/{plan_id}/coordination — start coordination and send initial emails idempotently.
  - GET /api/plans/{plan_id}/coordination — return task progress, history, and delivery results.
  - POST /api/plans/{plan_id}/coordination/notifications/{contact_id}/retry — retry one failed recipient, with a
    maximum of two total attempts.

  Add magic-link endpoints:

  - POST /api/coordination/session — exchange a token for a scoped HTTP-only cookie.
  - GET /api/coordination — return the recipient identity, activity, shared tasks, and history.
  - POST /api/coordination/tasks/{task_type}/actions — approve, claim, take over, release, complete, or mark not
    needed.

  - DELETE /api/coordination/session — clear the coordination cookie.

  All task mutations include an expected version. Concurrent changes return 409, prompting the page to refresh.

  ## Commit Sequence

  1. feat: add trusted-circle coordination schema
      - Add append-only Supabase migrations for coordination tasks, hashed links, audit events, notification
        attempt counts, and new coordinating/completed plan states.

      - Migrate existing awaiting_approval plans to coordinating; existing shared plans retain a “Previously
        approved” legacy approval.

      - Keep old support-offer data temporarily for migration safety, but stop using it in the new flow.

  2. feat: add coordination lifecycle api
      - Implement launch, shared-state, task-action, automatic-completion, cancellation, and concurrency rules.
      - Add magic-link exchange and cookie authentication.
      - Keep all public coordination access behind a valid contact-and-plan token.

  3. feat: send personalized coordination emails
      - Build plain-text and HTML emails containing activity details, the recipient’s unique PeiPal link, and
        concise instructions for approval, registration, and transport.

      - Automatically send on the first coordination request.
      - Record sent, failed, missing-email, and retry-exhausted results.
      - Permit only one explicit retry after the initial attempt; retries rotate the failed recipient’s token.

  4. feat: add trusted-circle coordination page
      - Add public /coordinate/$token and token-free /coordinate routes outside authenticated routing.
      - Show “You are responding as [name],” shared task ownership, confirmation before takeover, and audit
        history.

      - Poll shared state every five seconds and immediately refresh after mutations.
      - Provide dedicated invalid, expired, cancelled, and completed pages.

  5. feat: show coordination progress in elderly plans
      - Make Ask my trusted circle start coordination and email all confirmed contacts in one action.
      - Add a My Plans page showing delivery, approval, registration, transport, completion, and cancellation.
      - Show which emails succeeded or failed and expose retry only when permitted.
      - Display plain-language ownership such as “Anna approved” and “David is arranging transport.”

  6. refactor: remove family-facing authenticated flows
      - Remove the demo family view, authenticated family portal, role-based navigation, and generic support-
        offer interface.

      - Retire direct-sharing behavior so new plans always begin as private drafts.
      - Keep setup as onboarding/settings; the organizer creates the elderly account and trusted circle, then
        hands over that same account.

      - Change authenticated navigation to Discover, My Plans, and Settings.

  7. docs: document trusted-circle coordination workflow
      - Regenerate OpenAPI frontend types.
      - Update environment documentation with PUBLIC_APP_URL, secure-cookie behavior, Gmail requirements,
        migrations, and the demo walkthrough.

      - Document the credential-handoff limitation and recommend changing the password after the elderly person
        receives the account.

  ## Test Plan

  - Verify unique tokens identify different contacts while returning the same shared coordination state.
  - Reject invalid, expired, revoked, forwarded-after-removal, and cross-plan tokens.
  - Verify first approval wins and further approval attempts return the existing approver.
  - Verify claim, release, confirmed takeover, completion, not-needed, and audit-history behavior.
  - Simulate simultaneous takeovers and confirm one succeeds while the stale request receives 409.
  - Confirm automatic completion requires approval plus resolved registration and transport.
  - Confirm cancellation overrides all magic-link task screens.
  - Verify all confirmed contacts are attempted, partial email failures remain visible, and only one retry is
    allowed.

  - Verify repeated coordination launch requests do not resend successful emails.
  - Test public coordination pages for loading, live refresh, completion, cancellation, invalid link, and
    keyboard accessibility.
  - Run backend tests, frontend tests, lint, production build, OpenAPI generation, and a manual multi-contact
    walkthrough.

  ## Assumptions

  - Registration and transport each have one owner, but either task may be marked not needed.
  - Approval needs only one trusted contact and cannot be transferred.
  - Trusted contacts are considered eligible only when confirmed and not revoked.
  - Contacts without an email appear as undeliverable; other contacts are still emailed.
  - Magic-link possession is the trusted contact’s authentication. A forwarded link therefore acts as that
    recipient, and the page makes the active identity prominent.

  - The organizer has no separate continuing role or account. Setup actions are recorded under the elderly
    account, and credential handoff happens outside PeiPal.

  - The coordination page shows names and responsibilities to the whole trusted circle, but not private contact
    details.