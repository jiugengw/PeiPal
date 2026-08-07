# PeiPal

PeiPal helps an older adult ask their whole family for support, instead of putting one person on the spot.

The product is designed around a simple, low-pressure idea:

> “I would like to go” should not feel like “someone must take responsibility.”

Rather than sending a direct request to one person, PeiPal asks the entire family at once. Every family member receives the same request, and the first person to approve or reject decides for everyone. PeiPal then tells the whole family, and the older adult, what happened.

## The experience

```text
An organizer creates an account with an email and password
→ creates the family
→ adds the older adults, each with their own email
→ adds family members and how they are related
→ each older adult gets a sign-in link, and never needs a password
→ the older adult finds an activity and asks their family
→ every family member is emailed their own link
→ the first person to approve or reject decides for everyone
→ anyone can offer to sign them up or get them there
→ the plan is ready once all three are settled, and done afterwards
```

## Who is who

Three kinds of people, and only one of them has a password.

| | How they sign in | What they do |
|---|---|---|
| **Organizer** | Email and password | Owns the family group, adds older adults and family members |
| **Older adult** | Their email is their login; a magic link each time, **never a password** | Finds activities, asks the family, sees how it is going |
| **Family member** | **No account at all.** Their own link in every email | Approves, rejects, or offers to help |

Nobody ever hands over a password. The organizer keeps their own account, and
each older adult gets their own way in, so setup actions are recorded honestly
against the person who really did them.

One family can support several older adults, and the relationship is stored per
older adult, so the same person can be a *daughter* to one and a *sister* to
another.

## What the family is asked

Asking the family creates three tasks everyone can see, and emails every family
member their own link:

| Task | Rule |
|---|---|
| **Approval** | The first person to approve or reject decides for everyone. It cannot be handed on. |
| **Signing up** | One person at a time. They can step back, hand it over, finish it, or the family can mark it not needed. |
| **Getting there** | The same. |

Links carry a random token, stored only as a hash, and stay usable for the whole
plan so family members can return to see how things are going. They expire seven
days after the activity, and are revoked if the member is removed.

## First-decision-wins, and no lost work

The first valid decision settles the request for the whole family. Any later
attempt is told it has already been decided.

Every change carries the version the page was showing. If two people act at the
same moment, one succeeds and the other is refused and shown what actually
happened, rather than quietly overwriting it. A rejection ends the plan outright.

A signed-in account cannot shortcut any of this. Approving, rejecting, and
helping belong to the family members holding their links.

## Ready, then done

A plan becomes **ready** the moment it is approved and both practical tasks are
resolved. Afterwards the older adult marks it **done**. Cancelling is the only
status change a signed-in account makes directly.

## Notification failure behaviour

Every recipient of a decision email gets its own delivery record, so a failure is visible rather than silent.

- Successful and failed deliveries are recorded per recipient.
- Failed deliveries can be retried, and anyone already emailed is skipped rather than emailed twice.
- **PeiPal never claims a notification succeeded when delivery failed.** If some recipients could not be reached, it says how many; if none could, it says so.

## What the prototype demonstrates

- An organizer account, and passwordless sign-in for each older adult
- Several older adults in one family, with a relationship per older adult
- Nearby activity discovery, with mobility, language, and transport context
- One request that reaches the whole family at once
- First-decision-wins approval, and shared ownership of signing up and transport
- A shared page every family member can return to, with the full history
- Per-recipient email delivery tracking, including failures that can be retried
- An optional browser voice companion that uses the same activity and plan workflow as the visible controls

## Why it matters

Older adults may want to join in without feeling that they are burdening a particular family member. Asking everyone at once, and letting the first answer settle it, keeps support visible and shared while keeping the older adult’s choice at the centre.

## Demo walkthrough

1. Anna signs up with her email and password and creates the **Lim Family**.
2. She adds her mother **Mary**, including Mary's own email address.
3. She adds family members — herself as *Daughter of Mary*, her brother **David**
   as *Son of Mary*.
4. She presses **Send sign-in link**, and Mary taps it once on her tablet. Mary
   is now signed in, with no password to remember.
5. Mary finds a quiet nearby activity and presses **Ask my family**.
6. Anna and David each receive their own link.
7. David opens his and approves. Anna's link now shows the plan as approved, and
   offers her the chance to help instead.
8. Anna takes on getting Mary there. David marks signing up as not needed.
9. The plan turns **ready**, and everyone can see who is doing what.
10. After the activity, Mary marks it **done**.

The final demo message:

> “PeiPal helps an older adult ask their whole family for support. Every family member receives the same request, and the first person to approve or reject decides for everyone. PeiPal then tells the entire family and the older adult what happened.”

## Current scope

The prototype focuses on coordination. It does not itself arrange transport or complete bookings: it records which family member has taken those on. Family members act through their emailed links rather than accounts of their own.

Technical setup, API documentation, migrations, testing, and troubleshooting are in [DEVELOPMENT.md](DEVELOPMENT.md).
