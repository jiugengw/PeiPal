"""Emails that carry each family member's own coordination link."""

from __future__ import annotations

from datetime import datetime, timezone
import os
from typing import Any

from supabase import Client

from src.services.family_email import digest, generate_token
from src.services.notifications import send_email


def coordination_url(token: str) -> str:
    base = os.getenv("APP_BASE_URL", "http://127.0.0.1:5173").rstrip("/")
    return f"{base}/coordinate/{token}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def issue_link(client: Client, plan_id: int, family_member_id: int, expires_at: str) -> str:
    """Create or rotate one family member's link and return the raw token.

    The token is stored only as a hash, and the link stays usable for the life
    of the plan so the family member can come back to watch progress.
    """

    token = generate_token()
    client.table("plan_coordination_links").upsert(
        {
            "plan_id": plan_id,
            "family_member_id": family_member_id,
            "token_hash": digest(token),
            "expires_at": expires_at,
            "revoked_at": None,
        },
        on_conflict="plan_id,family_member_id",
    ).execute()
    return token


def build_message(
    *, person_name: str, member_name: str, activity: dict[str, Any], url: str
) -> tuple[str, str, str]:
    """Subject, plain text, and HTML for one recipient's invitation."""

    subject = f"{person_name} would like to join an activity"
    text = "\n".join([
        f"Hello {member_name},",
        "",
        f"{person_name} would like to join {activity['name']}.",
        "",
        f"Where: {activity['location']}",
        f"When: {activity['start_at']}",
        "",
        "Your whole family received this. The first person to answer decides for",
        "everyone, and you can also offer to help with registration or transport.",
        "",
        f"Open this link to approve, reject, or help: {url}",
        "",
        "You can return to the same link at any time to see how it is going.",
    ])
    html = (
        f"<p>Hello {member_name},</p>"
        f"<p><strong>{person_name}</strong> would like to join "
        f"<strong>{activity['name']}</strong>.</p>"
        f"<p>Where: {activity['location']}<br>When: {activity['start_at']}</p>"
        "<p>Your whole family received this. The first person to answer decides for "
        "everyone, and you can also offer to help with registration or transport.</p>"
        f'<p><a href="{url}">Approve, reject, or offer help</a></p>'
        "<p>You can return to the same link at any time to see how it is going.</p>"
    )
    return subject, text, html


def send_coordination_emails(
    client: Client,
    *,
    plan_id: int,
    family_id: int,
    person_name: str,
    activity: dict[str, Any],
    expires_at: str,
) -> list[dict[str, Any]]:
    """Email every family member their own link, recording each outcome.

    A recipient already emailed successfully is skipped, so relaunching or
    retrying never sends a second copy.
    """

    members = (
        client.table("family_members")
        .select("id, name, email")
        .eq("family_id", family_id)
        .execute()
        .data
        or []
    )

    deliveries: list[dict[str, Any]] = []
    for member in members:
        member_id = int(member["id"])
        summary = {"recipient_role": "family_member", "name": member["name"]}

        existing = (
            client.table("plan_decision_notifications")
            .select("id, status")
            .eq("plan_id", plan_id)
            .eq("family_member_id", member_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if existing and existing[0]["status"] == "sent":
            deliveries.append({**summary, "status": "already_sent"})
            continue

        if existing:
            record_id = existing[0]["id"]
            client.table("plan_decision_notifications").update({
                "status": "pending", "error_message": None, "attempted_at": _now(),
            }).eq("id", record_id).execute()
        else:
            record_id = (
                client.table("plan_decision_notifications")
                .insert({
                    "plan_id": plan_id,
                    "recipient_role": "family_member",
                    "family_member_id": member_id,
                    "recipient_name": member["name"],
                    "recipient_email": member.get("email"),
                    "status": "pending",
                    "attempted_at": _now(),
                })
                .execute()
                .data[0]["id"]
            )

        if not member.get("email"):
            error_message = "This family member has no email address."
            client.table("plan_decision_notifications").update({
                "status": "failed", "error_message": error_message,
            }).eq("id", record_id).execute()
            deliveries.append({**summary, "status": "failed", "error": error_message})
            continue

        # A retry rotates the token, so a link in a failed send never works.
        token = issue_link(client, plan_id, member_id, expires_at)
        subject, text, html = build_message(
            person_name=person_name,
            member_name=member["name"],
            activity=activity,
            url=coordination_url(token),
        )
        try:
            provider_id = send_email(
                recipient_email=member["email"],
                subject=subject,
                body=text,
                html_body=html,
                idempotency_key=f"coordination/{plan_id}/{member_id}",
            )
        except Exception:
            error_message = "Email delivery failed."
            client.table("plan_decision_notifications").update({
                "status": "failed", "error_message": error_message,
            }).eq("id", record_id).execute()
            deliveries.append({**summary, "status": "failed", "error": error_message})
        else:
            client.table("plan_decision_notifications").update({
                "status": "sent", "provider_id": provider_id,
                "sent_at": _now(), "error_message": None,
            }).eq("id", record_id).execute()
            deliveries.append({**summary, "status": "sent", "provider_id": provider_id})

    return deliveries
