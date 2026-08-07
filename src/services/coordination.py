"""Shared coordination of one plan by the whole family.

Three tasks are visible to everyone: approval, registration, and transport.
Approval is settled by the first person to answer, and cannot be transferred.
Registration and transport each have at most one owner, who may hand them on.

A plan becomes `ready` the moment approval is granted and both practical tasks
are resolved. Rejection ends the plan outright.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from supabase import Client


TASK_TYPES = ("approval", "registration", "transport")
PRACTICAL_TASKS = ("registration", "transport")
RESOLVED_PRACTICAL = {"done", "not_needed"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _conflict() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Someone in the family changed this first. Refreshing so you can see the latest.",
    )


def ensure_coordination(client: Client, plan_id: int) -> dict[str, Any]:
    """Return the coordination record for a plan, creating it and its tasks."""

    existing = (
        client.table("plan_coordination")
        .select("*")
        .eq("plan_id", plan_id)
        .limit(1)
        .execute()
        .data
    )
    if existing:
        return existing[0]

    record = (
        client.table("plan_coordination")
        .insert({"plan_id": plan_id})
        .execute()
        .data[0]
    )
    client.table("plan_coordination_tasks").insert([
        {"coordination_id": record["id"], "task_type": task_type}
        for task_type in TASK_TYPES
    ]).execute()
    return record


def load_state(client: Client, plan_id: int) -> dict[str, Any]:
    """The shared view: tasks, history, and the version to send back."""

    records = (
        client.table("plan_coordination")
        .select("*")
        .eq("plan_id", plan_id)
        .limit(1)
        .execute()
        .data
    )
    if not records:
        raise HTTPException(status_code=404, detail="This plan has not been shared with the family yet.")
    record = records[0]

    tasks = (
        client.table("plan_coordination_tasks")
        .select("*")
        .eq("coordination_id", record["id"])
        .execute()
        .data
        or []
    )
    events = (
        client.table("plan_coordination_events")
        .select("*")
        .eq("coordination_id", record["id"])
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    return {"coordination": record, "tasks": tasks, "events": events}


def _task(client: Client, coordination_id: int, task_type: str) -> dict[str, Any]:
    rows = (
        client.table("plan_coordination_tasks")
        .select("*")
        .eq("coordination_id", coordination_id)
        .eq("task_type", task_type)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="That task is not part of this plan.")
    return rows[0]


def _record_event(
    client: Client,
    coordination_id: int,
    *,
    task_type: str | None,
    action: str,
    actor_id: int | None,
    actor_name: str,
    detail: str | None = None,
) -> None:
    client.table("plan_coordination_events").insert({
        "coordination_id": coordination_id,
        "task_type": task_type,
        "action": action,
        "actor_family_member_id": actor_id,
        "actor_name": actor_name,
        "detail": detail,
    }).execute()


def _guarded_update(
    client: Client, task: dict[str, Any], values: dict[str, Any]
) -> dict[str, Any]:
    """Apply a task change only if nobody else changed it first."""

    updated = (
        client.table("plan_coordination_tasks")
        .update({**values, "version": task["version"] + 1, "updated_at": _now()})
        .eq("id", task["id"])
        .eq("version", task["version"])
        .execute()
        .data
    )
    if not updated:
        raise _conflict()
    return updated[0]


def _refresh_plan_status(client: Client, plan_id: int, coordination_id: int) -> str:
    """Move the plan to ready once approval and both practical tasks are settled."""

    tasks = (
        client.table("plan_coordination_tasks")
        .select("task_type, status")
        .eq("coordination_id", coordination_id)
        .execute()
        .data
        or []
    )
    by_type = {task["task_type"]: task["status"] for task in tasks}

    if by_type.get("approval") == "rejected":
        client.table("plans").update({"status": "rejected"}).eq("id", plan_id).eq(
            "status", "coordinating"
        ).execute()
        return "rejected"

    is_ready = by_type.get("approval") == "approved" and all(
        by_type.get(task_type) in RESOLVED_PRACTICAL for task_type in PRACTICAL_TASKS
    )
    if is_ready:
        client.table("plans").update({"status": "ready", "ready_at": _now()}).eq(
            "id", plan_id
        ).eq("status", "coordinating").execute()
        return "ready"
    return "coordinating"


def apply_action(
    client: Client,
    *,
    plan_id: int,
    coordination_id: int,
    task_type: str,
    action: str,
    expected_version: int,
    actor_id: int,
    actor_name: str,
    reason: str | None = None,
) -> dict[str, Any]:
    """Run one family member's action against a task, or refuse it with 409."""

    if task_type not in TASK_TYPES:
        raise HTTPException(status_code=404, detail="That task is not part of this plan.")

    task = _task(client, coordination_id, task_type)
    if task["version"] != expected_version:
        raise _conflict()

    if task_type == "approval":
        if action not in {"approve", "reject"}:
            raise HTTPException(status_code=400, detail="Approval can only be approved or rejected.")
        if task["status"] in {"approved", "rejected"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This plan has already been decided by the family.",
            )
        decided = "approved" if action == "approve" else "rejected"
        _guarded_update(client, task, {
            "status": decided,
            "decided_by_family_member_id": actor_id,
            "reason": reason,
            "resolved_at": _now(),
        })
        _record_event(
            client, coordination_id,
            task_type=task_type, action=decided, actor_id=actor_id,
            actor_name=actor_name, detail=reason,
        )
        return {"plan_status": _refresh_plan_status(client, plan_id, coordination_id)}

    # Registration and transport: one owner, who may hand the task on.
    if action == "claim":
        if task["status"] in RESOLVED_PRACTICAL:
            raise HTTPException(status_code=409, detail="That task is already settled.")
        if task["owner_family_member_id"] and task["owner_family_member_id"] != actor_id:
            raise HTTPException(
                status_code=409,
                detail="Someone else is already doing this. Take it over if you need to.",
            )
        _guarded_update(client, task, {"status": "claimed", "owner_family_member_id": actor_id})
        _record_event(client, coordination_id, task_type=task_type, action="claimed",
                      actor_id=actor_id, actor_name=actor_name)

    elif action == "take_over":
        if task["status"] in RESOLVED_PRACTICAL:
            raise HTTPException(status_code=409, detail="That task is already settled.")
        _guarded_update(client, task, {"status": "claimed", "owner_family_member_id": actor_id})
        _record_event(client, coordination_id, task_type=task_type, action="took over",
                      actor_id=actor_id, actor_name=actor_name)

    elif action in {"release", "complete"}:
        if task["owner_family_member_id"] != actor_id:
            raise HTTPException(
                status_code=403,
                detail="Only the person doing this task can change it.",
            )
        if action == "release":
            _guarded_update(client, task, {"status": "open", "owner_family_member_id": None})
            _record_event(client, coordination_id, task_type=task_type, action="stepped back",
                          actor_id=actor_id, actor_name=actor_name)
        else:
            _guarded_update(client, task, {"status": "done", "resolved_at": _now()})
            _record_event(client, coordination_id, task_type=task_type, action="completed",
                          actor_id=actor_id, actor_name=actor_name)

    elif action == "not_needed":
        if task["owner_family_member_id"]:
            raise HTTPException(
                status_code=409,
                detail="Someone is already doing this, so it cannot be marked as not needed.",
            )
        _guarded_update(client, task, {"status": "not_needed", "resolved_at": _now()})
        _record_event(client, coordination_id, task_type=task_type, action="marked not needed",
                      actor_id=actor_id, actor_name=actor_name)

    else:
        raise HTTPException(status_code=400, detail="That action is not available for this task.")

    return {"plan_status": _refresh_plan_status(client, plan_id, coordination_id)}
