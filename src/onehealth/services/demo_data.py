from __future__ import annotations

from datetime import date, timedelta

from onehealth.dhis2.ebs import EBSSignalInput, build_signal_bundle, build_stage_event


DEMO_PREFIX = "DEMO-EBS-"


DEMO_SCENARIOS = (
    {"suffix": "001", "title": "Closed zoonotic exposure investigation", "location": "BD-DHA", "risk": "CRITICAL", "officer": "Dr Amina Rahman", "due": -5, "status": "COMPLETED", "close": True},
    {"suffix": "002", "title": "Overdue fever cluster response", "location": "BD-CTG", "risk": "HIGH", "officer": "Md Karim Hossain", "due": -3, "status": "IN_PROGRESS"},
    {"suffix": "003", "title": "Diarrhoeal illness response due today", "location": "BD-KHU", "risk": "MEDIUM", "officer": "Dr Nusrat Jahan", "due": 0, "status": "IN_PROGRESS"},
    {"suffix": "004", "title": "High-risk respiratory cluster due soon", "location": "BD-SYL", "risk": "HIGH", "officer": "Farhana Akter", "due": 1, "status": "PLANNED"},
    {"suffix": "005", "title": "Unassigned high-risk rash cluster", "location": "BD-RAJ", "risk": "HIGH"},
    {"suffix": "006", "title": "Verified low-risk animal illness report", "location": "BD-RAN", "risk": "LOW"},
    {"suffix": "007", "title": "Vector-control response on track", "location": "BD-BAR", "risk": "MEDIUM", "officer": "Tanvir Ahmed", "due": 7, "status": "IN_PROGRESS"},
    {"suffix": "008", "title": "Water contamination response on hold", "location": "BD-MYM", "risk": "HIGH", "officer": "Dr Sabiha Islam", "due": 5, "status": "ON_HOLD"},
    {"suffix": "009", "title": "Completed community risk communication", "location": "BD-DHA", "risk": "LOW", "officer": "Rafiq Hasan", "due": -1, "status": "COMPLETED"},
    {"suffix": "010", "title": "Critical unexplained mortality investigation", "location": "BD-CTG", "risk": "CRITICAL", "investigation_only": True},
)


def build_demo_bundles(org_units: dict[str, str], *, today: date) -> list[tuple[str, dict]]:
    bundles = []
    for index, scenario in enumerate(DEMO_SCENARIOS, start=1):
        signal_id = f"{DEMO_PREFIX}{scenario['suffix']}"
        detected_on = today - timedelta(days=min(index + 1, 10))
        org_unit_uid = org_units[str(scenario["location"])]
        bundle = build_signal_bundle(EBSSignalInput(
            signal_id=signal_id,
            title=str(scenario["title"]),
            source="OneHealth training simulation",
            signal_type="DISEASE_CLUSTER",
            description="Synthetic training record for operational workflow demonstration. No patient or personally identifiable data.",
            org_unit_uid=org_unit_uid,
            detected_on=detected_on,
        ))
        enrollment_uid = bundle["enrollments"][0]["enrollment"]

        stages = [
            ("verification", {"verification_status": "VERIFIED", "verification_notes": "Confirmed as a synthetic training scenario."}),
            ("risk_assessment", {"likelihood_score": 4 if scenario["risk"] in {"HIGH", "CRITICAL"} else 2, "impact_score": 5 if scenario["risk"] == "CRITICAL" else 3, "risk_level": scenario["risk"]}),
        ]
        if scenario.get("investigation_only") or scenario.get("officer"):
            stages.append(("investigation", {"investigation_status": "COMPLETED", "samples_collected": 3, "findings": "Synthetic investigation completed for dashboard training."}))
        if scenario.get("officer"):
            due_date = today + timedelta(days=int(scenario["due"]))
            stages.append(("response", {
                "recommended_actions": "Coordinate field verification, update the incident log and brief the surveillance lead.",
                "responsible_officer": scenario["officer"],
                "due_date": due_date.isoformat(),
                "response_status": scenario["status"],
            }))
        if scenario.get("close"):
            stages.append(("closure", {"outcome": "CONTROLLED", "closure_date": today.isoformat(), "lessons_learned": "Synthetic exercise completed; escalation and reporting steps were reviewed."}))

        for stage_index, (stage, values) in enumerate(stages, start=1):
            event = build_stage_event(
                stage=stage,
                enrollment_uid=enrollment_uid,
                org_unit_uid=org_unit_uid,
                occurred_on=min(today, detected_on + timedelta(days=stage_index)),
                values=values,
            )["events"][0]
            bundle["events"].append(event)
        bundles.append((signal_id, bundle))
    return bundles
