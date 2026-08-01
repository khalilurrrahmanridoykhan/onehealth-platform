import secrets
import string
from dataclasses import dataclass
from datetime import date
from typing import Any


EBS_TRACKED_ENTITY_TYPE_UID = "OhEbsSig001"
EBS_PROGRAM_UID = "OhEbsProg01"
BANGLADESH_UTC_OFFSET = "+06:00"


def _bangladesh_midnight(value: date) -> str:
    """Represent a Bangladesh reporting date without shifting it into the future in UTC."""
    return f"{value.isoformat()}T00:00:00.000{BANGLADESH_UTC_OFFSET}"

EBS_ATTRIBUTES = {
    "signal_id": "OhEbsId0001",
    "title": "OhEbsTit001",
    "source": "OhEbsSrc001",
}

EBS_STAGES = {
    "detection": "OhEbsDet001",
    "verification": "OhEbsVer001",
    "risk_assessment": "OhEbsRas001",
    "investigation": "OhEbsInvSt1",
    "response": "OhEbsRes001",
    "closure": "OhEbsClo001",
}

EBS_DATA_ELEMENTS = {
    "signal_type": "OhEbsTyp001",
    "description": "OhEbsDes001",
    "verification_status": "OhEbsVrf001",
    "verification_notes": "OhEbsVnt001",
    "likelihood_score": "OhEbsLik001",
    "impact_score": "OhEbsImp001",
    "risk_level": "OhEbsRsk001",
    "investigation_status": "OhEbsInv001",
    "samples_collected": "OhEbsSam001",
    "findings": "OhEbsFin001",
    "recommended_actions": "OhEbsAct001",
    "responsible_officer": "OhEbsOff001",
    "due_date": "OhEbsDue001",
    "response_status": "OhEbsRsp001",
    "outcome": "OhEbsOut001",
    "closure_date": "OhEbsCls001",
    "lessons_learned": "OhEbsLes001",
}

EBS_STAGE_FIELDS = {
    "verification": {"verification_status", "verification_notes"},
    "risk_assessment": {"likelihood_score", "impact_score", "risk_level"},
    "investigation": {"investigation_status", "samples_collected", "findings"},
    "response": {
        "recommended_actions",
        "responsible_officer",
        "due_date",
        "response_status",
    },
    "closure": {"outcome", "closure_date", "lessons_learned"},
}

EBS_REQUIRED_FIELDS = {
    "verification": {"verification_status"},
    "risk_assessment": {"likelihood_score", "impact_score", "risk_level"},
    "investigation": {"investigation_status"},
    "response": {"recommended_actions", "responsible_officer", "response_status"},
    "closure": {"outcome", "closure_date"},
}


def generate_dhis2_uid() -> str:
    first = secrets.choice(string.ascii_letters)
    remaining = "".join(
        secrets.choice(string.ascii_letters + string.digits) for _ in range(10)
    )
    return first + remaining


@dataclass(frozen=True, slots=True)
class EBSSignalInput:
    signal_id: str
    title: str
    source: str
    signal_type: str
    description: str
    org_unit_uid: str
    detected_on: date


def build_signal_bundle(
    signal: EBSSignalInput,
    *,
    tracked_entity_uid: str | None = None,
    enrollment_uid: str | None = None,
    event_uid: str | None = None,
) -> dict[str, Any]:
    tracked_entity_uid = tracked_entity_uid or generate_dhis2_uid()
    enrollment_uid = enrollment_uid or generate_dhis2_uid()
    event_uid = event_uid or generate_dhis2_uid()
    occurred_at = _bangladesh_midnight(signal.detected_on)

    return {
        "trackedEntities": [
            {
                "trackedEntity": tracked_entity_uid,
                "trackedEntityType": EBS_TRACKED_ENTITY_TYPE_UID,
                "orgUnit": signal.org_unit_uid,
                "attributes": [
                    {
                        "attribute": EBS_ATTRIBUTES["signal_id"],
                        "value": signal.signal_id,
                    },
                    {
                        "attribute": EBS_ATTRIBUTES["title"],
                        "value": signal.title,
                    },
                    {
                        "attribute": EBS_ATTRIBUTES["source"],
                        "value": signal.source,
                    },
                ],
            }
        ],
        "enrollments": [
            {
                "enrollment": enrollment_uid,
                "trackedEntity": tracked_entity_uid,
                "program": EBS_PROGRAM_UID,
                "orgUnit": signal.org_unit_uid,
                "status": "ACTIVE",
                "enrolledAt": occurred_at,
                "occurredAt": occurred_at,
            }
        ],
        "events": [
            {
                "event": event_uid,
                "program": EBS_PROGRAM_UID,
                "programStage": EBS_STAGES["detection"],
                "enrollment": enrollment_uid,
                "orgUnit": signal.org_unit_uid,
                "status": "COMPLETED",
                "occurredAt": occurred_at,
                "dataValues": [
                    {
                        "dataElement": EBS_DATA_ELEMENTS["signal_type"],
                        "value": signal.signal_type,
                    },
                    {
                        "dataElement": EBS_DATA_ELEMENTS["description"],
                        "value": signal.description,
                    },
                ],
            }
        ],
    }


def build_stage_event(
    *,
    stage: str,
    enrollment_uid: str,
    org_unit_uid: str,
    occurred_on: date,
    values: dict[str, str | int],
    event_uid: str | None = None,
    status: str = "COMPLETED",
) -> dict[str, Any]:
    if stage == "detection" or stage not in EBS_STAGES:
        raise ValueError(f"Unsupported follow-up EBS stage: {stage}")

    disallowed = sorted(set(values) - EBS_STAGE_FIELDS[stage])
    if disallowed:
        raise ValueError(
            f"Fields not allowed for {stage}: {', '.join(disallowed)}"
        )
    missing = sorted(EBS_REQUIRED_FIELDS[stage] - set(values))
    if missing:
        raise ValueError(
            f"Missing required fields for {stage}: {', '.join(missing)}"
        )

    for score_field in ("likelihood_score", "impact_score"):
        if score_field in values:
            try:
                score = int(values[score_field])
            except (TypeError, ValueError):
                raise ValueError(f"{score_field} must be an integer from 1 to 5") from None
            if not 1 <= score <= 5:
                raise ValueError(f"{score_field} must be an integer from 1 to 5")

    if "samples_collected" in values:
        try:
            sample_count = int(values["samples_collected"])
        except (TypeError, ValueError):
            raise ValueError("samples_collected must be a whole-number count of 0 or more") from None
        if sample_count < 0 or str(sample_count) != str(values["samples_collected"]).strip():
            raise ValueError("samples_collected must be a whole-number count of 0 or more")

    event = {
        "event": event_uid or generate_dhis2_uid(),
        "program": EBS_PROGRAM_UID,
        "programStage": EBS_STAGES[stage],
        "enrollment": enrollment_uid,
        "orgUnit": org_unit_uid,
        "status": status,
        "occurredAt": _bangladesh_midnight(occurred_on),
        "dataValues": [
            {"dataElement": EBS_DATA_ELEMENTS[field], "value": str(value)}
            for field, value in values.items()
        ],
    }
    return {"events": [event]}
