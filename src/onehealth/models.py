from dataclasses import dataclass
from datetime import date
from typing import Literal


RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]


@dataclass(frozen=True, slots=True)
class SurveillanceRecord:
    disease_code: str
    disease_name: str
    period_start: date
    period_end: date
    period_type: str
    period_label: str
    location_code: str
    location_name: str
    location_level: str
    cases: int
    deaths: int | None
    population: int | None
    incidence_per_100k: float | None
    data_status: str
    source_name: str
    source_url: str
    complete_period: bool


@dataclass(frozen=True, slots=True)
class AlertResult:
    disease_code: str
    location_code: str
    period: str
    risk_level: RiskLevel
    observed_cases: int
    expected_cases: float
    predicted_cases: float
    confidence: float
    reasons: tuple[str, ...]
    recommended_actions: tuple[str, ...]

