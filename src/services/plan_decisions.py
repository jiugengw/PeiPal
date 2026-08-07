"""Tell the whole family, and the older adult, what was decided.

Every recipient gets a delivery record so a failure is visible and can be
retried. Nothing here reports success it did not observe.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from supabase import Client

from src.services.notifications import send_plan_email


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def decision_message(
    *,
    decision: str,
    decided_by: str,
    decided_at: str,
    person_name: str,
    activity: dict[str, Any],
    reason: str | None = None,
) -> tuple[str, str]:
    """Build the subject and body describing a decision."""

    outcome = "approved" if decision == "approved" else "not approved"
    subject = f"{person_name}'s activity was {outcome}"
    lines = [
        f"{decided_by} {'approved' if decision == 'approved' else 'rejected'} "
        f"the request for {person_name}.",
        "",
        f"Activity: {activity['name']}",
        f"Where: {activity['location']}",
        f"When: {activity['start_at']}",
        f"Decided by: {decided_by}",
        f"Decided at: {decided_at}",
    ]
    if reason:
        lines += ["", f"They added: {reason}"]
    lines += ["", f"More information: {activity['info_link']}"]
    return subject, "\n".join(lines)


def _recipients(client: Client, family_id: int, older_adult_id: int) -> list[dict[str, Any]]:
    """Every family member, plus the older adult when an email is known."""

    members = (
        client.table("family_members")
        .select("id, name, email")
        .eq("family_id", family_id)
        .execute()
        .data
        or []
    )
    recipients: list[dict[str, Any]] = [
        {
            "recipient_role": "family_member",
            "family_member_id": int(member["id"]),
            "older_adult_id": None,
            "recipient_name": member["name"],
            "recipient_email": member.get("email"),
        }
        for member in members
    ]

    profile = (
        client.table("older_adult_profiles")
        .select("name, preferred_name, email")
        .eq("id", older_adult_id)
        .limit(1)
        .execute()
        .data
    )
    if profile and profile[0].get("email"):
        recipients.append({
            "recipient_role": "older_adult",
            "family_member_id": None,
            "older_adult_id": int(older_adult_id),
            "recipient_name": profile[0].get("preferred_name") or profile[0]["name"],
            "recipient_email": profile[0]["email"],
        })
    return recipients


def _existing_record(client: Client, plan_id: int, recipient: dict[str, Any]) -> dict[str, Any] | None:
    query = (
        client.table("plan_decision_notifications")
        .select("id, status")
        .eq("plan_id", plan_id)
    )
    if recipient["recipient_role"] == "family_member":
        query = query.eq("family_member_id", recipient["family_member_id"])
    else:
        query = query.eq("older_adult_id", recipient["older_adult_id"])
    rows = query.limit(1).execute().data or []
    return rows[0] if rows else None


def send_decision_notifications(
    client: Client,
    *,
    plan_id: int,
    family_id: int,
    older_adult_id: int,
    subject: str,
    body: str,
) -> list[dict[str, Any]]:
    """Email every recipient and record what actually happened to each one.

    A recipient already marked `sent` is never emailed twice, so retrying only
    re-attempts the failures.
    """

    deliveries: list[dict[str, Any]] = []
    for recipient in _recipients(client, family_id, older_adult_id):
        summary = {
            "recipient_role": recipient["recipient_role"],
            "name": recipient["recipient_name"],
        }
        existing = _existing_record(client, plan_id, recipient)
        if existing and existing["status"] == "sent":
            deliveries.append({**summary, "status": "already_sent"})
            continue

        if existing:
            record_id = existing["id"]
            client.table("plan_decision_notifications").update({
                "status": "pending",
                "recipient_name": recipient["recipient_name"],
                "recipient_email": recipient["recipient_email"],
                "error_message": None,
                "attempted_at": _now(),
            }).eq("id", record_id).execute()
        else:
            record_id = (
                client.table("plan_decision_notifications")
                .insert({**recipient, "plan_id": plan_id, "status": "pending", "attempted_at": _now()})
                .execute()
                .data[0]["id"]
            )

        if not recipient["recipient_email"]:
            error_message = "This recipient has no email address."
            client.table("plan_decision_notifications").update({
                "status": "failed",
                "error_message": error_message,
            }).eq("id", record_id).execute()
            deliveries.append({**summary, "status": "failed", "error": error_message})
            continue

        key_part = (
            f"member-{recipient['family_member_id']}"
            if recipient["recipient_role"] == "family_member"
            else f"older-adult-{recipient['older_adult_id']}"
        )
        try:
            provider_id = send_plan_email(
                recipient_email=recipient["recipient_email"],
                subject=subject,
                body=body,
                idempotency_key=f"plan-decision/{plan_id}/{key_part}",
            )
        except Exception:
            error_message = "Email delivery failed."
            client.table("plan_decision_notifications").update({
                "status": "failed",
                "error_message": error_message,
            }).eq("id", record_id).execute()
            deliveries.append({**summary, "status": "failed", "error": error_message})
        else:
            client.table("plan_decision_notifications").update({
                "status": "sent",
                "provider_id": provider_id,
                "sent_at": _now(),
                "error_message": None,
            }).eq("id", record_id).execute()
            deliveries.append({**summary, "status": "sent", "provider_id": provider_id})

    return deliveries


def delivery_summary(deliveries: list[dict[str, Any]]) -> str:
    """Describe delivery truthfully, including partial and total failure."""

    failed = [item for item in deliveries if item["status"] == "failed"]
    delivered = [item for item in deliveries if item["status"] in {"sent", "already_sent"}]
    if not deliveries:
        return "Your decision was recorded. There was nobody to notify."
    if not failed:
        return "Your decision was recorded and everyone was notified by email."
    if not delivered:
        return (
            "Your decision was recorded, but no notification email could be sent. "
            "The family can retry sending it."
        )
    return (
        f"Your decision was recorded. {len(delivered)} of {len(deliveries)} people were "
        f"notified by email; {len(failed)} could not be reached and can be retried."
    )
