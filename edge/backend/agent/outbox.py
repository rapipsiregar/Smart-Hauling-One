"""Durable local queue for crossings not yet acknowledged (SRS §4).

The single most important property: no crossing is ever silently lost. Every
non-2xx response retries with backoff -- including 401 and 422, because a 401 may
just mean a rotated key hasn't propagated, and a dropped crossing is worse than a
stuck one (a stuck one is visible as ``local_queue_depth`` on the dashboard).

The ONLY path by which a crossing is discarded is the explicit size-ceiling
eviction in :meth:`Outbox.enforce_ceiling`, which logs loudly.
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import uuid
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from pathlib import Path

from agent.backoff import backoff_delay
from agent.config import OUTBOX_CEILING_BYTES, Settings
from agent.induk_client import IndukClient

SCHEMA = """
CREATE TABLE IF NOT EXISTS outbox (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotency_key  TEXT NOT NULL UNIQUE,
    camera_code      TEXT NOT NULL,
    payload_json     TEXT NOT NULL,
    snapshot_path    TEXT,
    created_at       TEXT NOT NULL,
    attempt_count    INTEGER NOT NULL DEFAULT 0,
    next_attempt_at  TEXT NOT NULL,
    last_error       TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_next_attempt ON outbox(next_attempt_at);
"""


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


class Outbox:
    """SQLite-backed queue. Survives process restarts by construction."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.db_path = Path(settings.outbox_db)
        self.snapshot_dir = Path(settings.snapshot_dir)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.snapshot_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        with self._connect() as conn:
            conn.executescript(SCHEMA)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=30)
        conn.row_factory = sqlite3.Row
        return conn

    def enqueue(self, *, camera_code: str, payload: dict, snapshot: bytes | None) -> str:
        """Persist one crossing. Returns its idempotency key.

        The key is generated ONCE here and reused on every retry -- that is what
        lets the induk de-duplicate (SRS §5.2).
        """
        key = str(uuid.uuid4())
        snapshot_path = None
        if snapshot:
            snapshot_path = str(self.snapshot_dir / f"{key}.jpg")
            Path(snapshot_path).write_bytes(snapshot)

        now = _utc_now()
        with self._lock, self._connect() as conn:
            conn.execute(
                "INSERT INTO outbox (idempotency_key, camera_code, payload_json, "
                "snapshot_path, created_at, next_attempt_at) VALUES (?, ?, ?, ?, ?, ?)",
                (key, camera_code, json.dumps(payload), snapshot_path, _iso(now), _iso(now)),
            )
        self.enforce_ceiling()
        return key

    def depth(self) -> int:
        """Rows pending. Reported on every heartbeat (API_CONTRACT §1.2)."""
        with self._connect() as conn:
            return int(conn.execute("SELECT COUNT(*) FROM outbox").fetchone()[0])

    def next_due(self):
        """Oldest row whose backoff has elapsed. Strict insertion order (SRS §4.2)."""
        with self._connect() as conn:
            return conn.execute(
                "SELECT * FROM outbox WHERE next_attempt_at <= ? ORDER BY id ASC LIMIT 1",
                (_iso(_utc_now()),),
            ).fetchone()

    def delete(self, row_id: int, snapshot_path: str | None) -> None:
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM outbox WHERE id = ?", (row_id,))
        if snapshot_path and os.path.exists(snapshot_path):
            os.remove(snapshot_path)

    def record_failure(self, row, error: str) -> None:
        attempt = int(row["attempt_count"]) + 1
        delay = backoff_delay(attempt)
        retry_at = _utc_now() + timedelta(seconds=delay)
        with self._lock, self._connect() as conn:
            conn.execute(
                "UPDATE outbox SET attempt_count = ?, next_attempt_at = ?, last_error = ? "
                "WHERE id = ?",
                (attempt, _iso(retry_at), error[:500], row["id"]),
            )

    def _total_bytes(self) -> int:
        total = self.db_path.stat().st_size if self.db_path.exists() else 0
        with self._connect() as conn:
            paths = [
                r["snapshot_path"] for r in conn.execute(
                    "SELECT snapshot_path FROM outbox WHERE snapshot_path IS NOT NULL"
                )
            ]
        for path in paths:
            if os.path.exists(path):
                total += os.path.getsize(path)
        return total

    def enforce_ceiling(self) -> int:
        """Evict oldest-first past the ceiling. The ONLY loss path (SRS §4.4).

        A device that has evicted anything should be treated as needing
        maintenance, not as a silent statistic -- hence the loud log.
        """
        evicted = 0
        while self._total_bytes() > OUTBOX_CEILING_BYTES:
            with self._connect() as conn:
                oldest = conn.execute(
                    "SELECT * FROM outbox ORDER BY id ASC LIMIT 1"
                ).fetchone()
            if oldest is None:
                break
            print(
                "outbox: CEILING EXCEEDED -- DROPPING CROSSING "
                f"{oldest['idempotency_key']} created {oldest['created_at']}. "
                "This device needs attention."
            )
            self.delete(int(oldest["id"]), oldest["snapshot_path"])
            evicted += 1
        return evicted


class OutboxSender(threading.Thread):
    """Drains the outbox one row at a time, in detection order (SRS §4.2).

    Never parallelise this: one row at a time guarantees in-order delivery, and a
    4-device fleet's crossing rate never approaches needing concurrency.
    """

    def __init__(
        self,
        outbox: Outbox,
        client: IndukClient,
        on_delivered: Callable[[str], None] | None = None,
    ) -> None:
        """``on_delivered`` receives the idempotency key of each accepted row.

        The queue empties as it drains, so once a row is gone there is nothing
        left to say whether it arrived. The gate's own history is kept separately
        (``app/store.py``) and this is the only moment that can mark a crossing
        delivered -- which is what the "Kirim" column at the gate reads. Optional
        because ``agent/main.py`` runs the agent standalone, with no local store.
        """
        super().__init__(name="outbox-sender", daemon=True)
        self.outbox = outbox
        self.client = client
        self.on_delivered = on_delivered
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def run(self) -> None:
        while not self._stop.is_set():
            row = self.outbox.next_due()
            if row is None:
                self._stop.wait(timeout=1.0)
                continue
            try:
                response = self.client.submit_crossing(
                    idempotency_key=row["idempotency_key"],
                    payload_json=row["payload_json"],
                    snapshot_path=row["snapshot_path"],
                )
                if response.status_code in (200, 201):
                    self._deliver(row)
                else:
                    self.outbox.record_failure(row, f"HTTP {response.status_code}")
            except Exception as err:
                self.outbox.record_failure(row, str(err))

    def _deliver(self, row) -> None:
        """Drop the queued row, then record the delivery locally.

        In that order, and with the callback guarded: a failing notification must
        never resurrect a row the induk has already accepted, because the retry
        would be a duplicate submission.
        """
        self.outbox.delete(int(row["id"]), row["snapshot_path"])
        if self.on_delivered is None:
            return
        try:
            self.on_delivered(row["idempotency_key"])
        except Exception as err:  # pragma: no cover - defensive
            print(f"outbox: delivered {row['idempotency_key']} but could not "
                  f"record it locally ({err})")
