# Section 11 — Outbox, Heartbeat, Live View & Entrypoint

**Goal:** the agent survives network outages, converges on central config, streams on demand, and
runs as one process.
**Depends on:** [10](./10-edge-agent-pipeline.md).

Implements `docs/edge-system/SRS.md` §4 (outbox), §3.5 (heartbeat/config), §8.2 (live view WHIP),
§7.1 (local video retention).

---

## 11.1 [DONE] `edge/agent/outbox.py`

```python
"""Durable local queue for crossings not yet acknowledged (SRS §4).

The single most important property: no crossing is ever silently lost. Every
non-2xx response retries with backoff -- including 401 and 422, because a 401 may
just mean a rotated key hasn't propagated, and a dropped crossing is worse than a
stuck one (a stuck one is visible as local_queue_depth on the dashboard).

The ONLY path by which a crossing is discarded is the explicit size-ceiling
eviction in enforce_ceiling(), which logs loudly.
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
import uuid
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
        self.db_path = settings.outbox_db
        self.snapshot_dir = settings.snapshot_dir
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

    def next_due(self) -> sqlite3.Row | None:
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

    def record_failure(self, row: sqlite3.Row, error: str) -> None:
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
                r["snapshot_path"] for r in
                conn.execute("SELECT snapshot_path FROM outbox WHERE snapshot_path IS NOT NULL")
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
    """Drains the outbox one row at a time, in detection order (SRS §4.2)."""

    def __init__(self, outbox: Outbox, client: IndukClient) -> None:
        super().__init__(name="outbox-sender", daemon=True)
        self.outbox = outbox
        self.client = client
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
                    self.outbox.delete(int(row["id"]), row["snapshot_path"])
                else:
                    self.outbox.record_failure(row, f"HTTP {response.status_code}")
            except Exception as err:
                self.outbox.record_failure(row, str(err))
```

> **Never parallelise this.** One row at a time guarantees in-order delivery, and a 4-device
> fleet's crossing rate never approaches needing concurrency (SRS §4.2).

---

## 11.2 [DONE] `edge/agent/heartbeat.py`

```python
"""Heartbeat + config watcher (docs/edge-system/SRS.md §3.5).

Config convergence is deliberately lazy: there is up to one heartbeat interval
(<=30s) of lag between applying a config and reporting it applied. That matches
the PRD's "applied within one heartbeat interval" criterion -- this is not
sub-second reconciliation, and does not need to be.
"""

from __future__ import annotations

import threading

from agent.config import AGENT_VERSION, HEARTBEAT_INTERVAL_SEC, Tunables, TunableStore
from agent.induk_client import IndukClient
from agent.outbox import Outbox


class HeartbeatThread(threading.Thread):
    def __init__(self, client: IndukClient, tunables: TunableStore, outbox: Outbox) -> None:
        super().__init__(name="heartbeat", daemon=True)
        self.client = client
        self.tunables = tunables
        self.outbox = outbox
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def fetch_and_apply_config(self) -> None:
        """Pull the authoritative config and swap it in atomically.

        On failure, keep running with the last-known-good config. The next
        heartbeat still reports a stale applied_config_version, so the induk will
        say config_changed again -- self-healing with no extra state (SRS §3.5).
        """
        payload = self.client.get_config()
        self.tunables.swap(Tunables.from_api(payload))
        print(f"heartbeat: applied config version {payload['config_version']}")

    def beat_once(self) -> None:
        current = self.tunables.get()
        response = self.client.heartbeat(
            agent_version=AGENT_VERSION,
            applied_config_version=current.config_version,
            local_queue_depth=self.outbox.depth(),
            status="online",
        )
        if response.get("config_changed"):
            self.fetch_and_apply_config()

    def run(self) -> None:
        # Fetch config once at startup so the agent never runs on defaults it was
        # never told to use.
        try:
            self.fetch_and_apply_config()
        except Exception as err:
            print(f"heartbeat: initial config fetch failed ({err}); using defaults")

        while not self._stop.wait(timeout=HEARTBEAT_INTERVAL_SEC):
            try:
                self.beat_once()
            except Exception as err:
                print(f"heartbeat: failed ({err}); will retry next interval")
```

---

## 11.3 [DONE] `edge/agent/live_view.py`

```python
"""Live-view long-poll + WHIP push (docs/edge-system/SRS.md §8.2).

THE ONE INVIOLABLE RULE: this pushes RAW frames. No bounding boxes, no hull-ID
text, no annotation of any kind, ever (PRD Goal 7 / Non-Goal). Detection results
reach the dashboard only as consensus-voted crossing events. If you find yourself
importing anything from agent.pipeline here, stop -- that is the bug.

Frames come from the SAME ring buffer the inference loop reads: never a second
RTSP connection to the camera, which could exceed its concurrent-client limit.
"""

from __future__ import annotations

import asyncio
import threading

from agent.config import LIVE_POLL_WAIT_SEC
from agent.induk_client import IndukClient


class LiveViewThread(threading.Thread):
    """Holds the long-poll open and starts/stops the WHIP push on command."""

    def __init__(self, client: IndukClient, ring) -> None:
        super().__init__(name="live-view", daemon=True)
        self.client = client
        self.ring = ring
        self._stop = threading.Event()
        self._active_session: str | None = None
        self._pusher: "WhipPusher | None" = None

    def stop(self) -> None:
        self._stop.set()
        self._stop_push()

    def _start_push(self, session_id: str, whip_url: str, whip_token: str) -> None:
        if self._active_session == session_id:
            return
        self._stop_push()
        print(f"live_view: starting WHIP push for session {session_id}")
        self._pusher = WhipPusher(self.ring, whip_url, whip_token)
        self._pusher.start()
        self._active_session = session_id

    def _stop_push(self) -> None:
        if self._pusher is not None:
            self._pusher.stop()
            self._pusher = None
        self._active_session = None

    def run(self) -> None:
        while not self._stop.is_set():
            try:
                action = self.client.poll_live_session(LIVE_POLL_WAIT_SEC)
            except Exception as err:
                print(f"live_view: poll failed ({err}); retrying")
                self._stop.wait(timeout=5.0)
                continue

            kind = action.get("action")
            if kind == "start":
                self._start_push(
                    action["session_id"], action["whip_url"], action["whip_token"]
                )
            elif kind == "stop":
                # A stop for a session we are not pushing is a no-op, never an
                # error (API_CONTRACT §1.4).
                if self._active_session == action.get("session_id"):
                    print(f"live_view: stopping session {action['session_id']}")
                    self._stop_push()


class WhipPusher:
    """Pushes raw ring-buffer frames to the relay over WebRTC (aiortc).

    Runs its own asyncio loop on a dedicated thread: aiortc is async, the rest of
    the agent is threaded, and this is the seam between them.
    """

    def __init__(self, ring, whip_url: str, whip_token: str) -> None:
        self.ring = ring
        self.whip_url = whip_url
        self.whip_token = whip_token
        self._thread: threading.Thread | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._stop = threading.Event()

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, name="whip-push", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._loop is not None:
            self._loop.call_soon_threadsafe(self._loop.stop)

    def _run(self) -> None:
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._push())
        except Exception as err:
            print(f"whip: push ended ({err})")
        finally:
            self._loop.close()

    async def _push(self) -> None:
        """Negotiate WHIP and stream until stopped.

        Implementation notes for whoever wires this against a real relay:
          1. Build an aiortc RTCPeerConnection.
          2. Add a VideoStreamTrack whose recv() pulls ring.latest() and wraps it
             in an av.VideoFrame -- RAW, no drawing.
          3. Create an offer, POST the SDP to whip_url with
             Authorization: Bearer {whip_token}, Content-Type: application/sdp.
          4. setRemoteDescription with the SDP answer.
          5. Keep the connection open until self._stop is set.
        Left unimplemented here because it cannot be verified without a running
        MediaMTX (Section 07) -- build it against a real relay, not blind.
        """
        raise NotImplementedError(
            "WHIP push requires a running media relay; see Section 07 and the "
            "steps in this docstring."
        )
```

> This is the **only** deliberately unimplemented function in the plan. Writing WebRTC negotiation
> blind, with no relay to test against, produces code that looks right and works never. Section 07
> stands up the relay; implement `_push` against it and delete the `NotImplementedError`. The
> long-poll control path around it is complete and testable now.

---

## 11.4 [DONE] `edge/agent/video_retention.py`

```python
"""Rolling local video buffer for dispute resolution (SRS §7.1).

Entirely separate from the outbox: different directory, different ceiling, never
competes with crossing delivery for space or I/O priority. Runs regardless of
whether any Detection Window is active.
"""

from __future__ import annotations

import shutil
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import cv2

from agent.config import (
    VIDEO_MIN_FREE_DISK_FRACTION,
    VIDEO_RETENTION_DAYS,
    VIDEO_SEGMENT_SEC,
)

SWEEP_INTERVAL_SEC = 600  # every 10 minutes


class VideoWriterThread(threading.Thread):
    """Writes rotating segments of the raw feed."""

    def __init__(self, ring, video_dir: Path, fps: int = 15) -> None:
        super().__init__(name="video-writer", daemon=True)
        self.ring = ring
        self.video_dir = video_dir
        self.fps = fps
        self.video_dir.mkdir(parents=True, exist_ok=True)
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def run(self) -> None:
        last_seq = 0
        while not self._stop.is_set():
            seq, frame = self.ring.wait_for_new(last_seq, timeout=2.0)
            if frame is None:
                continue
            last_seq = seq

            stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
            path = self.video_dir / f"segment-{stamp}.mp4"
            height, width = frame.shape[:2]
            writer = cv2.VideoWriter(
                str(path), cv2.VideoWriter_fourcc(*"mp4v"), self.fps, (width, height)
            )
            segment_end = time.monotonic() + VIDEO_SEGMENT_SEC
            try:
                while not self._stop.is_set() and time.monotonic() < segment_end:
                    seq, frame = self.ring.wait_for_new(last_seq, timeout=2.0)
                    if frame is None:
                        continue
                    last_seq = seq
                    writer.write(frame)
            finally:
                writer.release()


class RetentionSweep(threading.Thread):
    """Deletes oldest segments past the retention window or under disk pressure."""

    def __init__(self, video_dir: Path) -> None:
        super().__init__(name="video-retention", daemon=True)
        self.video_dir = video_dir
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def _low_disk(self) -> bool:
        usage = shutil.disk_usage(self.video_dir)
        return (usage.free / usage.total) < VIDEO_MIN_FREE_DISK_FRACTION

    def sweep_once(self) -> int:
        segments = sorted(self.video_dir.glob("segment-*.mp4"), key=lambda p: p.stat().st_mtime)
        cutoff = time.time() - VIDEO_RETENTION_DAYS * 86400
        removed = 0
        for segment in segments:
            too_old = segment.stat().st_mtime < cutoff
            if not too_old and not self._low_disk():
                break
            segment.unlink(missing_ok=True)
            removed += 1
        return removed

    def run(self) -> None:
        while not self._stop.wait(timeout=SWEEP_INTERVAL_SEC):
            try:
                self.sweep_once()
            except Exception as err:
                print(f"video_retention: sweep failed: {err}")
```

---

## 11.5 [DONE] `edge/agent/main.py`

```python
"""Edge agent entrypoint: wires up and starts every thread from SRS §3.1."""

from __future__ import annotations

import queue
import signal
import threading
import time

from agent.capture import CaptureThread, FrameRing
from agent.config import Settings, TunableStore
from agent.consensus import finalize_window
from agent.heartbeat import HeartbeatThread
from agent.induk_client import IndukClient
from agent.inference import InferenceLoop
from agent.live_view import LiveViewThread
from agent.outbox import Outbox, OutboxSender
from agent.video_retention import RetentionSweep, VideoWriterThread


class WindowFinalizer(threading.Thread):
    """Consumes closed windows, votes, and enqueues the result (SRS §3.1).

    Decoupled from the inference loop by a queue so DB writes and JPEG encoding
    never block frame capture.
    """

    def __init__(self, finalizer_queue: queue.Queue, outbox: Outbox, camera_code: str) -> None:
        super().__init__(name="finalizer", daemon=True)
        self.queue = finalizer_queue
        self.outbox = outbox
        self.camera_code = camera_code
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def run(self) -> None:
        while not self._stop.is_set():
            try:
                start_ts, end_ts, reads = self.queue.get(timeout=1.0)
            except queue.Empty:
                continue
            result = finalize_window(start_ts, end_ts, reads)
            payload = {
                "camera_code": self.camera_code,
                "detected_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "window_sec": round(result["window_sec"], 2),
                "hull_id": result["hull_id"],
                "confidence": result["confidence"],
                "read_count": result["read_count"],
                "votes": result["votes"],
            }
            key = self.outbox.enqueue(
                camera_code=self.camera_code,
                payload=payload,
                snapshot=result["snapshot"],
            )
            print(
                f"finalizer: {result['hull_id']} "
                f"({result['confidence']:.2f}, {result['read_count']} reads) queued as {key}"
            )


def main() -> None:
    settings = Settings.from_env()
    print(f"Smart Gate edge agent starting for {settings.camera_code}")

    ring = FrameRing()
    tunables = TunableStore()
    finalizer_queue: queue.Queue = queue.Queue()
    client = IndukClient(settings)
    outbox = Outbox(settings)

    threads = [
        CaptureThread(settings.rtsp_url, ring),
        InferenceLoop(ring, tunables, finalizer_queue, settings),
        WindowFinalizer(finalizer_queue, outbox, settings.camera_code),
        OutboxSender(outbox, client),
        HeartbeatThread(client, tunables, outbox),
        LiveViewThread(client, ring),
        VideoWriterThread(ring, settings.video_dir),
        RetentionSweep(settings.video_dir),
    ]
    for thread in threads:
        thread.start()

    shutdown = threading.Event()
    signal.signal(signal.SIGINT, lambda *_: shutdown.set())
    signal.signal(signal.SIGTERM, lambda *_: shutdown.set())
    shutdown.wait()

    print("edge agent: shutting down")
    for thread in threads:
        thread.stop()


if __name__ == "__main__":
    main()
```

---

## 11.6 [DONE] `edge/Dockerfile.jetson`

```dockerfile
# ARM64 / JetPack image for the Smart Gate edge agent.
# Deliberately NOT derived from the root Dockerfile -- different platform,
# different Python, different torch build (JetPack ships its own ARM64 wheels).
#
# Pick the l4t-ml tag matching the JetPack version on the actual devices:
#   ssh the Jetson and run: cat /etc/nv_tegra_release
FROM nvcr.io/nvidia/l4t-ml:r36.2.0-py3

WORKDIR /opt/smart-gate

RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg libsm6 libxext6 \
    && rm -rf /var/lib/apt/lists/*

COPY edge/pyproject.toml ./
RUN pip install --no-cache-dir -e .

# The agent imports the shared consensus functions from labs/ (SRS §10).
COPY labs/custom_model ./labs/custom_model
COPY edge/agent ./agent

ENV PYTHONUNBUFFERED=1
CMD ["python", "-m", "agent.main"]
```

---

## 11.7 [DONE] End-to-end verification against a mock induk

Real hardware is out of scope (`docs/test_plan.md` §2.2), but the whole path *is* verifiable
locally by swapping the camera for a video file.

```bash
# Terminal 1 -- the induk
cd backend && uv run python main.py web

# Register + provision a test gate
curl -X POST http://127.0.0.1:8000/api/cameras \
  -H 'Content-Type: application/json' \
  -d '{"camera_code":"GATE-TEST","name":"Local Test Gate","folder":"gate-test"}'
uv run python main.py provision-device GATE-TEST     # copy the printed key

# Terminal 2 -- the agent, reading a clip instead of RTSP
cd backend/edge
cp .env.example .env      # set SMART_GATE_RTSP_URL to a real file in data/01-playlist/
                          # set SMART_GATE_API_KEY to the key printed above
                          # set SMART_GATE_CAMERA_CODE=GATE-TEST
                          # set SMART_GATE_MODEL_PATH to ai-model/pak-shomad-v2.pt
uv run python -m agent.main
```

**Passing looks like:**
1. Agent logs `capture: connected`, then `heartbeat: applied config version N`.
2. `GET /api/cameras/GATE-TEST/edge-config` shows `device_status: "online"` and a fresh
   `last_heartbeat_at`.
3. As the clip plays, `finalizer: ... queued as <uuid>` lines appear.
4. `GET /api/crossings` includes crossings attributed to `GATE-TEST`.
5. Stopping the induk mid-run → the agent logs retries and `local_queue_depth` climbs; restarting
   it → the queue drains in order, with no duplicates in the DB.

Step 5 is the real TC-010-08 (outbox retry) and TC-010-02 (idempotency) proof, end to end.

---

## Acceptance for Section 11

- [ ] `cd edge && uv run pytest tests/ -q` passes.
- [ ] The mock-induk run above produces at least one crossing visible in `GET /api/crossings`.
- [ ] Killing and restarting the induk mid-run loses zero crossings and creates zero duplicates.
- [ ] `WhipPusher._push` is the only `NotImplementedError` in `edge/`, with its docstring intact.
- [ ] `grep -rn "^from app\.\|^import app\." edge/` returns nothing.
