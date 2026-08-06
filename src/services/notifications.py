"""Server-side email delivery for shared activity plans."""

from __future__ import annotations

import os

import resend


def send_plan_email(
    *,
    recipient_email: str,
    subject: str,
    body: str,
    idempotency_key: str,
) -> str:
    """Send one plan email and return the provider message id."""

    api_key = os.getenv("RESEND_API_KEY")
    sender = os.getenv("EMAIL_FROM")
    if not api_key or not sender:
        raise RuntimeError("RESEND_API_KEY and EMAIL_FROM must be configured.")

    resend.api_key = api_key
    message: resend.Emails.SendParams = {
        "from": sender,
        "to": [recipient_email],
        "subject": subject,
        "text": body,
    }
    reply_to = os.getenv("EMAIL_REPLY_TO")
    if reply_to:
        message["reply_to"] = reply_to
    response = resend.Emails.send(
        message,
        options={"idempotency_key": idempotency_key},
    )
    return str(response.get("id", "sent"))
