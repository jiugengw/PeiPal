# PeiPal

PeiPal helps an older adult ask their whole family for support, instead of putting one person on the spot.

The product is designed around a simple, low-pressure idea:

> “I would like to go” should not feel like “someone must take responsibility.”

Rather than sending a direct request to one person, PeiPal asks the entire family at once. Every family member receives the same request, and the first person to approve or reject decides for everyone. PeiPal then tells the whole family, and the older adult, what happened.

## The experience

```text
Family member creates an account
→ creates the family
→ verifies their email
→ adds older adults
→ adds family members and relationships
→ older adult chooses an activity
→ requests approval or practical help
→ all family members receive email links
→ first approve/reject decision wins
→ everyone, including the older adult, receives the result
```

## Family-member roles

A **family** is the coordinating group. Two kinds of people belong to it:

- **Family accounts** are signed-in users. The person who creates the family becomes its **owner**; other accounts may be `family_member` or `caregiver`. Accounts manage setup and can share an approved plan.
- **Family members** are the people the family can ask for support. They are records holding a name, an email address, and a relationship to each older adult. **They do not need an account** — they are reached by email and act through signed links.

One family can support several older adults, and the relationship is stored per older adult. The same person can be a *daughter* to one older adult and a *sister* to another.

## Email verification

The family is created by one person, who enters their own email address. PeiPal sends a six-digit code to that address, and the family is only confirmed once the code is verified. Codes are stored as a hash, expire after 30 minutes, and a wrong or expired code never confirms the address.

Setup continues even when email delivery is unavailable, but the interface says so plainly, so nobody assumes invitations were sent when they were not.

## Approval link behaviour

When an older adult asks for approval, **every** family member is emailed a link containing a random, single-use token. Only the hash of that token is stored, and it expires after seven days.

The link opens a page that needs no account, showing who the plan is for, the activity, and approve and reject buttons.

## First-decision-wins rule

The first valid decision settles the request for the whole family:

- The decision is applied with a guarded update that only matches a plan still `awaiting_approval`, so two simultaneous clicks cannot both win.
- Any later decision returns “already decided”.
- PeiPal records the decision, the family member who made it, the timestamp, and an optional reason.
- A signed-in account cannot shortcut this; deciding belongs to the emailed link.

Plans move through `draft → awaiting_approval → approved | rejected`, and an approved plan can then be `shared` so people can offer practical help. Any active plan can be `cancelled`.

## Booking and transport requests

Alongside plain approval, an older adult can ask for **booking help** or **transport help**. Once a plan is shared, family members can each offer one small kind of support: joining, a reminder, transport, booking help, encouragement, or suggesting an easier alternative. No one is assigned the whole responsibility.

## Notification failure behaviour

Every recipient of a decision email gets its own delivery record, so a failure is visible rather than silent.

- Successful and failed deliveries are recorded per recipient.
- Failed deliveries can be retried, and anyone already emailed is skipped rather than emailed twice.
- **PeiPal never claims a notification succeeded when delivery failed.** If some recipients could not be reached, it says how many; if none could, it says so.

## What the prototype demonstrates

- Family setup with a verified creator email
- Several older adults in one family, with a relationship per older adult
- Nearby activity discovery, with mobility, language, and transport context
- One request that reaches the whole family at once
- First-decision-wins approval through account-free email links
- Result emails to the whole family and to the older adult
- Per-recipient email delivery tracking, including failures that can be retried
- An optional browser voice companion that uses the same activity and plan workflow as the visible controls

## Why it matters

Older adults may want to join in without feeling that they are burdening a particular family member. Asking everyone at once, and letting the first answer settle it, keeps support visible and shared while keeping the older adult’s choice at the centre.

## Demo walkthrough

1. Anna signs up and creates the **Lim Family**, entering her own email address.
2. She receives a six-digit code and confirms the address.
3. She adds her mother **Mary** as an older adult, with an optional email so Mary hears the outcome directly.
4. She adds family members — herself as *Daughter of Mary*, her brother **David** as *Son of Mary* — each with an email address.
5. Mary picks a quiet nearby activity and asks the family to approve it.
6. Anna and David both receive an email with approve and reject links.
7. David opens his link first and approves. Anna’s link now reports that the request has already been decided.
8. Anna, David, and Mary all receive an email saying the activity was approved, who approved it, and when.

The final demo message:

> “PeiPal helps an older adult ask their whole family for support. Every family member receives the same request, and the first person to approve or reject decides for everyone. PeiPal then tells the entire family and the older adult what happened.”

## Current scope

The prototype focuses on coordination. It does not arrange transport, complete bookings, or track RSVP responses. Family members decide through their emailed links rather than through accounts of their own.

Technical setup, API documentation, migrations, testing, and troubleshooting are in [DEVELOPMENT.md](DEVELOPMENT.md).
