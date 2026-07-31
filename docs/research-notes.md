# Research Notes

## Activity Search Sources

- Google Places is the strongest MVP source for nearby places.
- General web search can find public event pages from community centres, libraries, parks, museums, ActiveSG-style programmes, Peatix, and Eventbrite.
- Eventbrite has an official API, but broad public event discovery should be validated before relying on it.
- Peatix does not appear to offer a reliable public event search API, so use web search links for MVP discovery.
- Facebook should not be a core source because Graph API access to friends, groups, and events is heavily permissioned.

## Contacts

- MVP should use manually added trusted contacts.
- Google Contacts or Microsoft Outlook Contacts can be considered later with OAuth.
- Phone contacts require a mobile app or native permission flow.
- Social media friend fetching is not recommended for MVP.

## Notifications

- WhatsApp share links or prepared message drafts are the simplest MVP path.
- Twilio SMS is a practical option for a stronger hackathon demo.
- WhatsApp Business Platform can support automated sending later, but requires setup, opt-in, and template constraints.

## Voice

- MVP can rely on browser, phone, or Wispr Flow dictation into the chat interface.
- Later versions can use native speech-to-text and text-to-speech.
- Conversation design should stay voice-friendly: short prompts, one question at a time, clear confirmations before external messages.
