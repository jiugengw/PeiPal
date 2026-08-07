"""Sign-in codes for older adults, delivered through PeiPal's own email.

Supabase remains the authority on the session, but it does not have to send the
message. Asking it to generate the code and sending that ourselves keeps every
PeiPal email coming from one address, and avoids the low rate limit on
Supabase's built-in mailer.
"""

from __future__ import annotations

from typing import Any

from supabase import Client

from src.services.notifications import send_email


def older_adult_for_email(client: Client, email: str) -> dict[str, Any] | None:
    """Only someone already added as an older adult may request a code."""

    rows = (
        client.table("older_adult_profiles")
        .select("id, name, preferred_name, email")
        .ilike("email", email)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None


def generate_code(client: Client, email: str) -> str:
    """Ask Supabase for a one-time code without letting it send the email."""

    response = client.auth.admin.generate_link({"type": "magiclink", "email": email})
    code = getattr(response.properties, "email_otp", None)
    if not code:
        raise RuntimeError("Supabase did not return a sign-in code.")
    return str(code)


def build_message(person_name: str, code: str) -> tuple[str, str, str]:
    subject = "Your PeiPal sign-in code"
    text = "\n".join([
        f"Hello {person_name},",
        "",
        f"Your PeiPal sign-in code is {code}",
        "",
        "Type it into the PeiPal sign-in page. It expires in one hour.",
        "",
        "If you did not ask to sign in, you can ignore this email.",
    ])
    html = (
        f"<p>Hello {person_name},</p>"
        "<p>Your PeiPal sign-in code is:</p>"
        f'<p style="font-size:32px;letter-spacing:8px;"><strong>{code}</strong></p>'
        "<p>Type it into the PeiPal sign-in page. It expires in one hour.</p>"
        "<p>If you did not ask to sign in, you can ignore this email.</p>"
    )
    return subject, text, html


def send_sign_in_code(client: Client, email: str, person_name: str) -> None:
    code = generate_code(client, email)
    subject, text, html = build_message(person_name, code)
    send_email(
        recipient_email=email,
        subject=subject,
        body=text,
        html_body=html,
        idempotency_key=f"sign-in-code/{email}/{code}",
    )
