from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from threading import RLock
from time import monotonic
from typing import Callable, Generic, Hashable, TypeVar


T = TypeVar("T")


@dataclass(frozen=True, slots=True)
class SnapshotMetadata:
    cache_state: str
    loaded_at: str
    age_seconds: float
    ttl_seconds: float
    stale_if_error_seconds: float
    last_error: str | None = None


@dataclass(frozen=True, slots=True)
class SnapshotResult(Generic[T]):
    value: T
    metadata: SnapshotMetadata


@dataclass(slots=True)
class _Entry(Generic[T]):
    value: T
    loaded_monotonic: float
    loaded_at: datetime


class SnapshotCache(Generic[T]):
    """Small process-local cache with an explicit stale-on-error state.

    Loading is serialized intentionally. The dashboard issues several parallel API
    requests; only the first request should query every configured DHIS2 dataset.
    """

    def __init__(self) -> None:
        self._entries: dict[Hashable, _Entry[T]] = {}
        self._last_metadata: dict[Hashable, SnapshotMetadata] = {}
        self._lock = RLock()

    @staticmethod
    def _metadata(
        entry: _Entry[T],
        *,
        state: str,
        now: float,
        ttl_seconds: float,
        stale_if_error_seconds: float,
        last_error: str | None = None,
    ) -> SnapshotMetadata:
        return SnapshotMetadata(
            cache_state=state,
            loaded_at=entry.loaded_at.astimezone(timezone.utc).isoformat(),
            age_seconds=round(max(0.0, now - entry.loaded_monotonic), 3),
            ttl_seconds=ttl_seconds,
            stale_if_error_seconds=stale_if_error_seconds,
            last_error=last_error,
        )

    def get_or_load(
        self,
        key: Hashable,
        loader: Callable[[], T],
        *,
        ttl_seconds: float,
        stale_if_error_seconds: float,
    ) -> SnapshotResult[T]:
        ttl_seconds = max(0.0, ttl_seconds)
        stale_if_error_seconds = max(ttl_seconds, stale_if_error_seconds)
        with self._lock:
            now = monotonic()
            entry = self._entries.get(key)
            if entry is not None and now - entry.loaded_monotonic <= ttl_seconds:
                metadata = self._metadata(
                    entry,
                    state="HIT",
                    now=now,
                    ttl_seconds=ttl_seconds,
                    stale_if_error_seconds=stale_if_error_seconds,
                )
                self._last_metadata[key] = metadata
                return SnapshotResult(entry.value, metadata)

            try:
                value = loader()
            except Exception as exc:
                now = monotonic()
                if (
                    entry is not None
                    and now - entry.loaded_monotonic <= stale_if_error_seconds
                ):
                    metadata = self._metadata(
                        entry,
                        state="STALE",
                        now=now,
                        ttl_seconds=ttl_seconds,
                        stale_if_error_seconds=stale_if_error_seconds,
                        last_error=str(exc),
                    )
                    self._last_metadata[key] = metadata
                    return SnapshotResult(entry.value, metadata)
                raise

            now = monotonic()
            entry = _Entry(
                value=value,
                loaded_monotonic=now,
                loaded_at=datetime.now(timezone.utc),
            )
            self._entries[key] = entry
            metadata = self._metadata(
                entry,
                state="MISS",
                now=now,
                ttl_seconds=ttl_seconds,
                stale_if_error_seconds=stale_if_error_seconds,
            )
            self._last_metadata[key] = metadata
            return SnapshotResult(value, metadata)

    def metadata(self, key: Hashable) -> SnapshotMetadata | None:
        with self._lock:
            metadata = self._last_metadata.get(key)
            entry = self._entries.get(key)
            if metadata is None or entry is None:
                return None
            return self._metadata(
                entry,
                state=metadata.cache_state,
                now=monotonic(),
                ttl_seconds=metadata.ttl_seconds,
                stale_if_error_seconds=metadata.stale_if_error_seconds,
                last_error=metadata.last_error,
            )

    def clear(self) -> int:
        with self._lock:
            count = len(self._entries)
            self._entries.clear()
            self._last_metadata.clear()
            return count
