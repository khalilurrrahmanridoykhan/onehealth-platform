from statistics import mean, pstdev

from onehealth.models import AlertResult, SurveillanceRecord


def generate_latest_alert(
    records: list[SurveillanceRecord], baseline_weeks: int = 4
) -> AlertResult | None:
    complete = [record for record in records if record.complete_period]
    # WAHIS HPAI records are a sparse historical event series, not a continuous
    # reporting feed. A rolling baseline across multi-year reporting gaps would
    # create a misleading early-warning classification.
    if complete and complete[0].disease_code == "HPAI":
        return None
    if len(complete) <= baseline_weeks:
        return None

    current = complete[-1]
    baseline = complete[-(baseline_weeks + 1) : -1]
    expected = mean(record.cases for record in baseline)
    ratio = current.cases / expected if expected else (float("inf") if current.cases else 1.0)

    if ratio >= 1.5:
        risk_level = "HIGH"
    elif ratio >= 1.2:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    values = [record.cases for record in baseline]
    variation = pstdev(values) if len(values) > 1 else 0.0
    confidence = max(0.5, min(0.95, 1 - variation / max(expected * 2, 1)))
    predicted = (current.cases * 0.6) + (expected * 0.4)
    percent_change = ((current.cases - expected) / expected * 100) if expected else 0.0

    if risk_level == "LOW":
        reasons = (f"Observed cases are {abs(percent_change):.1f}% {'below' if percent_change < 0 else 'above'} the 4-week baseline.",)
        actions = (
            "Continue routine measles surveillance and review MR vaccination coverage."
            if current.disease_code == "MEASLES"
            else "Continue routine weekly surveillance.",
        )
    else:
        reasons = (
            f"Observed cases are {percent_change:.1f}% above the 4-week baseline.",
            f"The alert threshold for {risk_level.lower()} risk was exceeded.",
        )
        actions = (
            (
                "Verify suspected cases and reporting completeness with the surveillance officer.",
                "Confirm specimen collection and laboratory linkage for suspected measles cases.",
                "Review MR vaccination coverage and assess the need for outbreak-response immunization.",
            )
            if current.disease_code == "MEASLES"
            else (
                "Verify the signal with the responsible surveillance officer.",
                "Review hospital capacity and laboratory reporting.",
                "Assess whether a field investigation is required.",
            )
        )

    return AlertResult(
        disease_code=current.disease_code,
        location_code=current.location_code,
        period=current.period_label,
        risk_level=risk_level,
        observed_cases=current.cases,
        expected_cases=round(expected, 2),
        predicted_cases=round(predicted, 2),
        confidence=round(confidence, 2),
        reasons=reasons,
        recommended_actions=actions,
    )
