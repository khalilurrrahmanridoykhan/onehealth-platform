from __future__ import annotations

from datetime import date
from typing import Iterable


STAGE_ORDER = (
    "detection",
    "verification",
    "risk_assessment",
    "investigation",
    "response",
    "closure",
)


def _iso_date(value: object) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def build_operation_item(
    entity: dict,
    attributes: dict[str, str],
    events: list[dict],
    *,
    today: date,
) -> dict:
    present = {event["stage"] for event in events}
    latest_stage = next(
        (stage for stage in reversed(STAGE_ORDER) if stage in present), "detection"
    )
    risk_events = [event for event in events if event["stage"] == "risk_assessment"]
    response_events = [event for event in events if event["stage"] == "response"]
    risk_values = risk_events[-1]["values"] if risk_events else {}
    response_values = response_events[-1]["values"] if response_events else {}
    due_date = _iso_date(response_values.get("due_date"))
    response_status = str(response_values.get("response_status") or "") or None
    closed = "closure" in present
    completed = closed or response_status == "COMPLETED"
    days_remaining = (due_date - today).days if due_date else None
    if completed:
        due_state = "COMPLETED"
    elif due_date is None:
        due_state = "UNSCHEDULED"
    elif days_remaining < 0:
        due_state = "OVERDUE"
    elif days_remaining == 0:
        due_state = "DUE_TODAY"
    elif days_remaining <= 2:
        due_state = "DUE_SOON"
    else:
        due_state = "ON_TRACK"

    enrollments = entity.get("enrollments") or []
    return {
        "tracked_entity_uid": entity.get("trackedEntity"),
        "enrollment_uid": enrollments[0].get("enrollment") if enrollments else None,
        "signal_id": attributes.get("signal_id", ""),
        "title": attributes.get("title", ""),
        "source": attributes.get("source", ""),
        "org_unit_uid": entity.get("orgUnit"),
        "latest_stage": latest_stage,
        "risk_level": risk_values.get("risk_level"),
        "responsible_officer": response_values.get("responsible_officer"),
        "recommended_actions": response_values.get("recommended_actions"),
        "due_date": due_date.isoformat() if due_date else None,
        "days_remaining": days_remaining,
        "due_state": due_state,
        "response_status": response_status,
        "closed": closed,
        "overdue": due_state == "OVERDUE",
        "event_count": len(events),
        "updated_at": entity.get("updatedAt"),
    }


def operation_summary(rows: list[dict]) -> dict[str, int]:
    return {
        "total": len(rows),
        "open": sum(not row["closed"] for row in rows),
        "closed": sum(row["closed"] for row in rows),
        "overdue": sum(row["overdue"] for row in rows),
        "due_soon": sum(row["due_state"] in {"DUE_TODAY", "DUE_SOON"} for row in rows),
        "unassigned": sum(not row["closed"] and not row["responsible_officer"] for row in rows),
        "high_risk": sum(
            row["risk_level"] in {"HIGH", "CRITICAL"} and not row["closed"]
            for row in rows
        ),
    }


def build_notifications(rows: Iterable[dict], *, today: date) -> list[dict]:
    notifications = []
    for row in rows:
        if row["closed"]:
            continue
        signal = row["signal_id"] or row["tracked_entity_uid"]
        if row["overdue"]:
            days = abs(row["days_remaining"] or 0)
            notifications.append({
                "id": f"overdue:{row['tracked_entity_uid']}",
                "type": "OVERDUE",
                "severity": "CRITICAL",
                "title": f"{signal} is overdue",
                "message": f"Response deadline passed by {days} day{'s' if days != 1 else ''}.",
                "signal_id": signal,
                "tracked_entity_uid": row["tracked_entity_uid"],
                "officer": row["responsible_officer"],
                "due_date": row["due_date"],
            })
        elif row["due_state"] in {"DUE_TODAY", "DUE_SOON"}:
            days = row["days_remaining"] or 0
            timing = "today" if days == 0 else f"in {days} days"
            notifications.append({
                "id": f"due:{row['tracked_entity_uid']}",
                "type": "DUE_SOON",
                "severity": "WARNING",
                "title": f"{signal} response is due {timing}",
                "message": "Review progress and update the response stage before the deadline.",
                "signal_id": signal,
                "tracked_entity_uid": row["tracked_entity_uid"],
                "officer": row["responsible_officer"],
                "due_date": row["due_date"],
            })
        if not row["responsible_officer"]:
            notifications.append({
                "id": f"unassigned:{row['tracked_entity_uid']}",
                "type": "UNASSIGNED",
                "severity": "WARNING" if row["risk_level"] in {"HIGH", "CRITICAL"} else "INFO",
                "title": f"{signal} needs an owner",
                "message": "Assign a responsible officer and response deadline.",
                "signal_id": signal,
                "tracked_entity_uid": row["tracked_entity_uid"],
                "officer": None,
                "due_date": row["due_date"],
            })
    rank = {"CRITICAL": 0, "WARNING": 1, "INFO": 2}
    return sorted(notifications, key=lambda item: (rank[item["severity"]], item["signal_id"]))
