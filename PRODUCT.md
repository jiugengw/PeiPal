# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

static HTML/CSS/JS prototype

## Users

PeiPal serves both older adults and the family members who help them. The older adult is the primary focus: they should be able to express interest in an activity without feeling that they are burdening someone. A family member or trusted friend helps with setup, practical decisions, and support.

## Product Purpose

PeiPal is a voice-first companion that helps older adults find nearby activities and turn interest into small, practical support from trusted family and friends. It also makes it easier for family members to help by keeping relevant context and support choices clear. Success means an older adult can move from “I would like to go” to a comfortable, supported plan with low pressure and clear approval.

## Positioning

The product's distinctive mechanism is low-pressure coordination: instead of making a direct invitation or assigning one person a burden, it lets a trusted circle support a plan through small actions such as joining, reminding, arranging transport, suggesting an alternative, encouraging, or helping book.

## Operating Context

The current prototype is a family-assisted setup flow followed by a voice- or chat-led activity planning experience. A family member may create and manage the older adult's profile, trusted circle, mobility context, language preference, and transport preference. Future plans are shared with the trusted circle only after confirmation.

## Capabilities and Constraints

- The current implementation is a local static web prototype for family-assisted setup.
- The broader MVP includes chat-first or voice-friendly activity discovery, practical support actions, and draft notifications.
- The Python agent can send a confirmed email notification to locally configured trusted contacts through Gmail SMTP.
- The prototype does not track responses, arrange transport, make bookings, or perform other external actions.
- Data and activity results are mock/demo data for now.
- The prototype has no selected app framework or production deployment target yet.
- Trusted contacts are manually added for the MVP.

## Brand Commitments

- Product name: PeiPal.
- The voice should be warm, respectful, practical, and low-pressure.
- The product should preserve the older adult's agency while making family support visible and manageable.

## Evidence on Hand

- Existing family-assisted setup prototype: `index.html`, `styles.css`, and `script.js`.
- Product concept, workflows, MVP scope, and demo scenario: `plan.md`.
- Local voice and typed-chat demos: `src/demo/voice_cli.py` and `src/demo/chat_cli.py`.
- No production customer evidence, testimonials, or live integrations are available; future work must not fabricate them.

## Product Principles

- Preserve the older adult's agency and dignity.
- Turn support into small, optional actions rather than obligations.
- Keep decisions and expectations clear for the family member helping.
- Ask for only the practical context needed to make a useful plan.
- Confirm before sharing plans or taking action with others.

## Accessibility & Inclusion

The experience should be suitable for older adults and family members, with simple language, low cognitive load, voice-friendly interaction, clear confirmation states, accessible form controls, and support for language, mobility, and transport needs. A formal accessibility standard has not yet been selected.
