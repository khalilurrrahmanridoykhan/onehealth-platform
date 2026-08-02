from datetime import date

from onehealth.services.operations import (
    build_notifications,
    build_operation_item,
    operation_summary,
)


def response_event(*, due_date: str, officer: str = "Dr Rahman", status: str = "IN_PROGRESS") -> dict:
    return {
        "stage": "response",
        "values": {
            "responsible_officer": officer,
            "due_date": due_date,
            "response_status": status,
            "recommended_actions": "Verify facilities and collect samples",
        },
    }


def test_operational_due_states_and_notifications():
    entity = {
        "trackedEntity": "Abcdef12345",
        "orgUnit": "BdDivDha001",
        "updatedAt": "2026-08-02T10:00:00.000",
        "enrollments": [{"enrollment": "Bcdefg12345"}],
    }
    attributes = {"signal_id": "EBS-2026-0001", "title": "Fever cluster", "source": "Hotline"}
    events = [
        {"stage": "detection", "values": {}},
        {"stage": "risk_assessment", "values": {"risk_level": "HIGH"}},
        response_event(due_date="2026-08-01"),
    ]

    item = build_operation_item(entity, attributes, events, today=date(2026, 8, 2))

    assert item["due_state"] == "OVERDUE"
    assert item["days_remaining"] == -1
    assert item["responsible_officer"] == "Dr Rahman"
    assert item["enrollment_uid"] == "Bcdefg12345"
    assert operation_summary([item])["overdue"] == 1
    notices = build_notifications([item], today=date(2026, 8, 2))
    assert notices[0]["severity"] == "CRITICAL"
    assert notices[0]["type"] == "OVERDUE"


def test_unassigned_high_risk_signal_creates_warning():
    item = build_operation_item(
        {"trackedEntity": "Abcdef12345", "orgUnit": "BdDivDha001"},
        {"signal_id": "EBS-2", "title": "Cluster", "source": "Community"},
        [{"stage": "risk_assessment", "values": {"risk_level": "HIGH"}}],
        today=date(2026, 8, 2),
    )

    assert item["due_state"] == "UNSCHEDULED"
    assert operation_summary([item])["unassigned"] == 1
    assert build_notifications([item], today=date(2026, 8, 2))[0]["type"] == "UNASSIGNED"
