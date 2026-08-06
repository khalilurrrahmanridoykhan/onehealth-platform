import onehealth.services.snapshot_cache as cache_module
from onehealth.services.snapshot_cache import SnapshotCache


def test_snapshot_cache_reuses_a_fresh_value():
    cache: SnapshotCache[list[int]] = SnapshotCache()
    calls = 0

    def load():
        nonlocal calls
        calls += 1
        return [calls]

    first = cache.get_or_load("records", load, ttl_seconds=60, stale_if_error_seconds=120)
    second = cache.get_or_load("records", load, ttl_seconds=60, stale_if_error_seconds=120)

    assert first.value == [1]
    assert first.metadata.cache_state == "MISS"
    assert second.value == [1]
    assert second.metadata.cache_state == "HIT"
    assert calls == 1


def test_snapshot_cache_uses_a_recent_snapshot_when_refresh_fails():
    cache: SnapshotCache[list[int]] = SnapshotCache()
    cache.get_or_load("records", lambda: [7], ttl_seconds=0, stale_if_error_seconds=120)

    result = cache.get_or_load(
        "records",
        lambda: (_ for _ in ()).throw(RuntimeError("DHIS2 unavailable")),
        ttl_seconds=0,
        stale_if_error_seconds=120,
    )

    assert result.value == [7]
    assert result.metadata.cache_state == "STALE"
    assert result.metadata.last_error == "DHIS2 unavailable"


def test_snapshot_cache_can_be_explicitly_cleared():
    cache: SnapshotCache[list[int]] = SnapshotCache()
    cache.get_or_load("records", lambda: [1], ttl_seconds=60, stale_if_error_seconds=120)

    assert cache.clear() == 1
    assert cache.metadata("records") is None


def test_cache_status_recalculates_snapshot_age(monkeypatch):
    times = iter((10.0, 10.0, 15.5))
    monkeypatch.setattr(cache_module, "monotonic", lambda: next(times))
    cache: SnapshotCache[list[int]] = SnapshotCache()
    cache.get_or_load("records", lambda: [1], ttl_seconds=60, stale_if_error_seconds=120)

    metadata = cache.metadata("records")

    assert metadata is not None
    assert metadata.age_seconds == 5.5
