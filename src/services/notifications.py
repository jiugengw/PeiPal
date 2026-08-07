"""Server-side email delivery for shared activity plans."""

from __future__ import annotations

import os
import smtplib
import ssl
from email.headerregistry import Address
from email.message import EmailMessage
from email.utils import make_msgid, parseaddr


GMAIL_SMTP_HOST = "smtp.gmail.com"
GMAIL_SMTP_PORT = 465


def _email_address(value: str, variable_name: str) -> str:
    _, address = parseaddr(value)
    if not address or "@" not in address:
        raise RuntimeError(f"{variable_name} must contain a valid email address.")
    return address


def send_email(
    *,
    recipient_email: str,
    subject: str,
    body: str,
    idempotency_key: str,
    html_body: str | None = None,
) -> str:
    """Send one email through Gmail SMTP and return its message id."""

    gmail_address = os.getenv("GMAIL_ADDRESS", "").strip()
    app_password = os.getenv("GMAIL_APP_PASSWORD", "").replace(" ", "")
    from_name = os.getenv("GMAIL_FROM_NAME", "Count Me In").strip() or "Count Me In"
    if not gmail_address or not app_password:
        raise RuntimeError("GMAIL_ADDRESS and GMAIL_APP_PASSWORD must be configured.")
    gmail_address = _email_address(gmail_address, "GMAIL_ADDRESS")
    if not gmail_address.lower().endswith("@gmail.com"):
        raise RuntimeError("GMAIL_ADDRESS must be a gmail.com address.")

    message = EmailMessage()
    message["From"] = Address(display_name=from_name, addr_spec=gmail_address)
    message["To"] = _email_address(recipient_email, "recipient_email")
    message["Subject"] = subject
    message["Message-ID"] = make_msgid(domain="gmail.com")
    message["X-Count-Me-In-Delivery-Key"] = idempotency_key
    message.set_content(body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(
        GMAIL_SMTP_HOST,
        GMAIL_SMTP_PORT,
        timeout=30,
        context=context,
    ) as smtp:
        smtp.login(gmail_address, app_password)
        smtp.send_message(message)
    return str(message["Message-ID"])


def send_plan_email(
    *,
    recipient_email: str,
    subject: str,
    body: str,
    idempotency_key: str,
) -> str:
    """Send one plan email and return the provider message id."""
    return send_email(
        recipient_email=recipient_email,
        subject=subject,
        body=body,
        idempotency_key=idempotency_key,
    )
