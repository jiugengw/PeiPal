# Count Me In Product Plan

## Summary

Count Me In is a voice-first companion agent that helps older adults discover nearby activities and turn interest into small, practical support from trusted family and friends.

The main product idea is not just activity search. The differentiator is helping older adults say "I would like to go" without making them feel like they are burdening one specific person. Their trusted circle can support the plan by joining, reminding, arranging transport, suggesting alternatives, encouraging them, or helping with booking.

## Core User Flow

1. A family member or friend creates an account for the elderly user.
2. They set up the elderly user's trusted circle, home area, mobility notes, language preference, and notification preferences.
3. The elderly user uses chat or voice to say what they want to do.
4. The agent asks simple follow-up questions about location, date, budget, mobility, and preferred activity style.
5. The agent searches for suitable nearby activities and returns a short list of good options.
6. The elderly user chooses an activity.
7. The agent sends the selected plan to the trusted circle.
8. Family and friends respond with small support actions.

## Support Actions

- Join: "I can go with you."
- Remind: "I will remind you that morning."
- Arrange transport: "I can drive you or help book a ride."
- Suggest alternative: "I found something nearer or easier."
- Encourage: "Looks nice, enjoy yourself."
- Help book: "I can register or reserve this for you."

## Key Features

### Family-Assisted Onboarding

Family and friends can create the elderly user's account so the elderly user does not need to handle complicated signup. The setup should collect only practical information needed for recommendations and notifications.

Initial profile fields:

- Name
- Preferred location or home area
- Language preference
- Mobility and accessibility needs
- Transport preference
- Trusted contacts
- Preferred notification method

### Voice-First Chat

The first version should work inside a chat interface and be easy to use through dictation. The agent should ask one question at a time, avoid long menus, and confirm before sending any message to others.

For the MVP, voice can be handled through browser or device dictation tools such as Wispr Flow or built-in voice input. Native speech-to-text and text-to-speech can come later.

### Activity Discovery

The agent should search for both fixed events and flexible places.

Activity sources for MVP:

- Google Places for nearby locations
- Web search for public event pages
- Peatix/Eventbrite-style event lookup through web search
- Community centres, libraries, parks, museums, ActiveSG-style programmes, and senior-friendly community activities

Results should be ranked by elderly-friendliness instead of general popularity.

Ranking factors:

- Distance
- Transport effort
- Cost
- Accessibility
- Indoor or outdoor setting
- Crowd and noise level
- Whether the activity can be seated or slow-paced
- Whether companionship or booking help may be useful

### Trusted Circle Notifications

The elderly user's selected activity becomes a shared plan that trusted people can support. The message should not frame the plan as a direct obligation for one person.

Example message:

> Mary is interested in going to a quiet craft session this Saturday afternoon. You can support by joining, reminding her, helping with transport, suggesting another option, or helping book.

### Website Later

A website can later become the trusted circle dashboard. It should show:

- Elderly user's upcoming interests
- Suggested activities
- Who has offered support
- Transport or booking needs
- Reminders and follow-up status

The website is not required for the first agent demo.

## MVP Demo Scenario

1. A daughter creates an account for her mother and adds trusted contacts.
2. The mother says: "I want to do something relaxing this weekend, but I do not want to trouble anyone."
3. The agent asks for location and mobility preferences.
4. The agent finds three nearby options.
5. The mother chooses a library craft session.
6. The agent drafts a trusted circle message and asks for confirmation.
7. Family and friends respond:
   - Daughter joins.
   - Son arranges transport.
   - Grandchild sets a reminder.
8. The agent confirms the plan with the mother.

## MVP Scope

Included:

- Chat-first agent flow
- Family-assisted account setup concept
- Manual trusted contact entry
- Activity search and ranking concept
- WhatsApp/SMS-style notification draft
- Support actions from trusted circle

Not included yet:

- Automatic social media friend fetching
- Full Facebook integration
- Native mobile contacts integration
- Full website dashboard
- Automated WhatsApp Business sending
- Payment or booking integrations

## Technical Direction

Suggested folder ownership:

- `src/agents/`: LLM orchestration and conversation state
- `src/prompts/`: System prompts, guardrails, and reusable conversation flows
- `src/services/activity-search/`: Google Places, web search, and event lookup adapters
- `src/services/notifications/`: WhatsApp links, SMS drafts, Twilio integration later
- `src/services/trusted-circle/`: Contact management and support response handling
- `src/models/`: Shared user, contact, activity, and support-action types
- `src/demo/`: Hackathon mock data and scripted demo flows

## Assumptions

- The first version is a planning scaffold only; no app framework is chosen yet.
- Trusted contacts are manually added for MVP.
- Family and friends can create and manage the elderly user's account.
- WhatsApp starts as share links or message drafts.
- Twilio SMS can be added later for a stronger demo.
- The strongest product angle is small support actions from trusted people, not activity search alone.
