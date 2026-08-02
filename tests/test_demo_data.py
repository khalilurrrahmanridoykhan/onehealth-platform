from datetime import date

from onehealth.services.demo_data import DEMO_PREFIX, build_demo_bundles


def test_demo_bundles_cover_operational_states_without_identifiable_data():
    org_units = {
        "BD-DHA": "BdDivDha001", "BD-CTG": "BdDivCtg001", "BD-KHU": "BdDivKhu001",
        "BD-SYL": "BdDivSyl001", "BD-RAJ": "BdDivRaj001", "BD-RAN": "BdDivRan001",
        "BD-BAR": "BdDivBar001", "BD-MYM": "BdDivMym001",
    }
    bundles = build_demo_bundles(org_units, today=date(2026, 8, 2))

    assert len(bundles) == 10
    assert all(signal_id.startswith(DEMO_PREFIX) for signal_id, _ in bundles)
    assert len({signal_id for signal_id, _ in bundles}) == 10
    event_counts = [len(bundle["events"]) for _, bundle in bundles]
    assert min(event_counts) >= 3
    assert max(event_counts) == 6
    serialized = str(bundles)
    assert "Synthetic" in serialized
    assert "patient name" not in serialized.casefold()
