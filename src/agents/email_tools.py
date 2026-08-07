"""Compact trusted-contact email tools for the PeiPal agent."""

from __future__ import annotations

from email.utils import parseaddr
from html import escape
import json
import os
from pathlib import Path
from typing import Any
from uuid import uuid4

from agents import function_tool
from src.services.notifications import send_email


MAXIMUM_SUBJECT_LENGTH = 160
MAXIMUM_BODY_LENGTH = 2_000
prepared_emails: dict[str, dict[str, Any]] = {}


def _contacts_path() -> Path:
    return Path(os.getenv("CONTACTS_FILE", "contacts.json"))


def _valid_email(address: str) -> bool:
    _, parsed_address = parseaddr(address)
    return parsed_address == address and "@" in address and "." in address.rsplit("@", 1)[-1]


def _load_contacts() -> list[dict[str, str]]:
    path = _contacts_path()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ValueError(f"Trusted contacts file was not found: {path}") from error
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Trusted contacts file could not be read: {path}") from error

    contacts = data.get("contacts") if isinstance(data, dict) else None
    if not isinstance(contacts, list):
        raise ValueError("Trusted contacts file must contain a contacts list.")

    required_fields = {"id", "name", "relationship", "email"}
    contact_ids: set[str] = set()
    validated_contacts: list[dict[str, str]] = []
    for contact in contacts:
        if not isinstance(contact, dict) or not required_fields <= contact.keys():
            raise ValueError("Every trusted contact needs an id, name, relationship, and email.")
        validated_contact = {
            field: str(contact[field]).strip() for field in required_fields
        }
        if not all(validated_contact.values()) or not _valid_email(validated_contact["email"]):
            raise ValueError(f"Trusted contact {validated_contact['id'] or '(unknown)'} is invalid.")
        if validated_contact["id"] in contact_ids:
            raise ValueError(f"Duplicate trusted contact id: {validated_contact['id']}")
        contact_ids.add(validated_contact["id"])
        validated_contacts.append(validated_contact)
    return validated_contacts


def list_trusted_contacts() -> str:
    """List trusted contacts without exposing their email addresses."""

    contacts = [
        {
            "id": contact["id"],
            "name": contact["name"],
            "relationship": contact["relationship"],
        }
        for contact in _load_contacts()
    ]
    return json.dumps({"contacts": contacts})


def prepare_invitation_email(contact_ids: list[str], subject: str, body: str) -> str:
    """Prepare an immutable invitation email for the user's review."""

    selected_ids = list(dict.fromkeys(contact_ids))
    if not selected_ids:
        raise ValueError("Choose at least one trusted contact.")

    subject = subject.strip()
    body = body.strip()
    if not subject or len(subject) > MAXIMUM_SUBJECT_LENGTH:
        raise ValueError(f"Subject must be 1-{MAXIMUM_SUBJECT_LENGTH} characters.")
    if not body or len(body) > MAXIMUM_BODY_LENGTH:
        raise ValueError(f"Message must be 1-{MAXIMUM_BODY_LENGTH} characters.")

    contacts_by_id = {contact["id"]: contact for contact in _load_contacts()}
    unknown_ids = [contact_id for contact_id in selected_ids if contact_id not in contacts_by_id]
    if unknown_ids:
        raise ValueError(f"Unknown trusted contact ids: {', '.join(unknown_ids)}")

    selected_contacts = [contacts_by_id[contact_id] for contact_id in selected_ids]
    prepared_email_id = str(uuid4())
    prepared_emails[prepared_email_id] = {
        "contacts": selected_contacts,
        "subject": subject,
        "body": body,
        "sent_contact_ids": set(),
    }
    return json.dumps(
        {
            "prepared_email_id": prepared_email_id,
            "recipients": [contact["name"] for contact in selected_contacts],
            "subject": subject,
            "body": body,
            "sent": False,
        }
    )


def _deliver_email(
    recipient: dict[str, str], subject: str, body: str, idempotency_key: str
) -> str:
    return send_email(
        recipient_email=recipient["email"],
        subject=subject,
        body=body,
        html_body=f"<p>{escape(body).replace(chr(10), '<br>')}</p>",
        idempotency_key=idempotency_key,
    )


def send_invitation_email(prepared_email_id: str) -> str:
    """Send a previously previewed invitation email to its selected contacts."""

    prepared_email = prepared_emails.get(prepared_email_id)
    if prepared_email is None:
        raise ValueError("Prepared email was not found. Please create a new preview.")

    delivery_results = []
    sent_contact_ids: set[str] = prepared_email["sent_contact_ids"]
    for recipient in prepared_email["contacts"]:
        if recipient["id"] in sent_contact_ids:
            delivery_results.append({"name": recipient["name"], "status": "already_sent"})
            continue
        try:
            provider_id = _deliver_email(
                recipient,
                prepared_email["subject"],
                prepared_email["body"],
                f"invitation/{prepared_email_id}/{recipient['id']}",
            )
        except Exception as error:
            delivery_results.append(
                {"name": recipient["name"], "status": "failed", "error": str(error)}
            )
        else:
            sent_contact_ids.add(recipient["id"])
            delivery_results.append(
                {"name": recipient["name"], "status": "sent", "provider_id": provider_id}
            )

    return json.dumps({"deliveries": delivery_results})


list_trusted_contacts_tool = function_tool(list_trusted_contacts)
prepare_invitation_email_tool = function_tool(prepare_invitation_email)
send_invitation_email_tool = function_tool(send_invitation_email)

EMAIL_TOOLS = [
    list_trusted_contacts_tool,
    prepare_invitation_email_tool,
    send_invitation_email_tool,
]
