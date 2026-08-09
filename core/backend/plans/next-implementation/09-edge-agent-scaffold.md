# Section 09 — Edge Agent Scaffold

**Goal:** the `edge/` package exists, with config, capture, and the shared retry policy.
**Depends on:** [03](./03-edge-ingestion-api.md). **Blocks:** 10, 11.

This is the software that runs on each of the 4 Jetson Orin Nano Super devices. Per
`docs/edge-system/SRS.md` §10 it is a **separate package with its own `pyproject.toml`**, targeting
ARM64/JetPack, and is intended to become an independent repository later.

**Two hard rules:**
1. **Never `import app.*`.** The agent talks to the induk only over HTTP. That coupling is exactly
   what would make the eventual repo split painful.
2. **It may import `labs.custom_model.ocr_utils`.** Deliberate shared-code exception (SRS §10) —
   both pipelines must call identical voting functions or they silently drift apart.

**Cannot be fully validated here.** No Jetson, no RTSP camera, no TensorRT. Sections 09–11 are
verified against a mock induk with a video file standing in for the camera.
`docs/test_plan.md` §2.2 puts real hardware out of scope.

---

## 9.1 [DONE] Package skeleton

```
backend/edge/
  pyproject.toml
  .env.example
  README.md
  agent/
    __init__.py
    config.py            # 9.3 -- shared config + atomic swap
    backoff.py           # 9.2 -- the one retry policy
    capture.py           # 9.4 -- RTSP -> ring buffer
    pipeline.py          # Section 10 -- Detection Window state machine
    consensus.py         # Section 10 -- window finalizer
    outbox.py            # Section 11 -- durable local queue
    heartbeat.py         # Section 11 -- heartbeat + config watcher
    live_view.py         # Section 11 -- long-poll + WHIP push
    video_retention.py   # Section 11 -- rolling local recording
    induk_client.py      # 9.5 -- HTTP client for the induk API
    main.py              # Section 11 -- wires up every thread
  Dockerfile.jetson
  tests/
    test_backoff.py
    test_pipeline.py     # Section 10
```

### `edge/pyproject.toml`

```toml
[project]
name = "smart-gate-edge-agent"
version = "0.1.0"
description = "Smart Gate edge agent: live hull-ID detection on a Jetson Orin Nano Super."
requires-python = ">=3.10"
dependencies = [
    "opencv-python>=4.10,<5",
    "numpy>=1.26",
    "requests>=2.32",
    "python-dotenv>=1.0",
    "aiortc>=1.9",            # WHIP push for live view (README decision #7)
    "av>=12.0",               # aiortc's media backend; also used for segment writing
]

[project.optional-dependencies]
# Installed from NVIDIA's JetPack wheels on real hardware, not from PyPI.
# Kept optional so the agent imports on a dev machine without a GPU.
inference = [
    "ultralytics>=8.4",
    "paddleocr[doc-parser]>=3.6.0",
]

[dependency-groups]
dev = ["pytest>=8.0"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

> Deliberately **not** a uv workspace member of the root `pyproject.toml`. The root project pins
> `torch` from a CUDA x86 index and requires `>=3.12,<3.14`; JetPack ships its own ARM64 torch and
> an older Python. Keeping them separate is the whole point of a second `pyproject.toml`.

### `edge/.env.example`

```bash
# Copy to .env on the device during provisioning (SRS §7.3 step 3).
SMART_GATE_INDUK_URL=https://induk.smartgate.example
SMART_GATE_API_KEY=paste-the-plaintext-key-from-provision-device-here
SMART_GATE_CAMERA_CODE=GATE-A

# Camera source. RTSP in production; a local video file works for testing.
SMART_GATE_RTSP_URL=rtsp://192.168.1.50:554/stream1

# Local storage
SMART_GATE_OUTBOX_DB=/var/lib/smart-gate/outbox.db
SMART_GATE_SNAPSHOT_DIR=/var/lib/smart-gate/snapshots
SMART_GATE_VIDEO_DIR=/var/lib/smart-gate/video

# Model weights (TensorRT-exported .engine in production; .pt works for testing)
SMART_GATE_MODEL_PATH=/opt/smart-gate/pak-shomad-v2.engine
```

Add `edge/.env` to the root `.gitignore` (the existing `.env` rule is unanchored, so it already
matches at any depth — verify with `git check-ignore -v edge/.env` and only add a rule if it
doesn't).

---

## 9.2 [DONE] `edge/agent/backoff.py`

One retry policy, used by both the outbox sender and the RTSP reconnect loop — SRS §4.3 is explicit
that there should be "only one retry policy to implement, not two."

```python
"""The single shared retry policy (docs/edge-system/SRS.md §4.3).

2s, 4s, 8s, 16s, 32s, 60s, 60s... with +/-20% jitter. Used by the outbox sender
(§4.2) and the RTSP capture reconnect (§3.1) alike.
"""

from __future__ import annotations

import random

INITIAL_DELAY_SEC = 2.0
MAX_DELAY_SEC = 60.0
JITTER_FRACTION = 0.2


def backoff_delay(attempt: int) -> float:
    """Delay before retry number ``attempt`` (1-based). Always positive."""
    if attempt < 1:
        attempt = 1
    base = min(MAX_DELAY_SEC, INITIAL_DELAY_SEC * (2 ** (attempt - 1)))
    jitter = base * random.uniform(-JITTER_FRACTION, JITTER_FRACTION)
    return max(0.1, base + jitter)
```

**`edge/tests/test_backoff.py`:**

```python
from agent.backoff import MAX_DELAY_SEC, backoff_delay


def test_grows_then_caps():
    assert 1.6 <= backoff_delay(1) <= 2.4        # 2s +/-20%
    assert 3.2 <= backoff_delay(2) <= 4.8        # 4s
    assert 6.4 <= backoff_delay(3) <= 9.6        # 8s
    for attempt in range(6, 40):
        assert backoff_delay(attempt) <= MAX_DELAY_SEC * 1.2


def test_never_zero_or_negative():
    assert all(backoff_delay(a) > 0 for a in range(-5, 50))


def test_jitter_makes_delays_differ():
    assert len({round(backoff_delay(5), 6) for _ in range(20)}) > 1
```

---

## 9.3 [DONE] `edge/agent/config.py`

```python
"""Agent configuration: static env settings + hot-swappable device tunables.

The tunables object is IMMUTABLE and replaced by reference, never mutated in
place (SRS §3.1, §6 thread safety). That is what guarantees the inference loop
never reads a half-updated config mid-frame.
"""

from __future__ import annotations

import os
import threading
from dataclasses import dataclass, replace
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# --- Code constants (PRD §9: NOT device settings) -----------------------------
OCR_MIN_AREA = 400                  # px^2, matches labs/custom_model/video_processor.py
DETECT_TRIGGER_CONF = 0.30          # min YOLO conf to open a Detection Window
NO_DETECTION_GRACE_SEC = 1.5        # close a window this long after the last detection
POST_WINDOW_COOLDOWN_SEC = 1.0      # suppress re-trigger right after a window closes
HEARTBEAT_INTERVAL_SEC = 30
LIVE_POLL_WAIT_SEC = 25
OUTBOX_CEILING_BYTES = 500 * 1024 * 1024
VIDEO_RETENTION_DAYS = 7
VIDEO_SEGMENT_SEC = 300             # 5-minute segments
VIDEO_MIN_FREE_DISK_FRACTION = 0.10
AGENT_VERSION = "1.0.0"


@dataclass(frozen=True)
class Tunables:
    """Device settings owned by the induk (API_CONTRACT §1.1). Frozen by design."""

    yolo_fps: int = 20
    ocr_fps: int = 4
    detect_window_sec: int = 6
    ocr_min_conf: float = 0.30
    dedup_iou: float = 0.92
    config_version: int = 0          # 0 = nothing applied yet since boot

    @classmethod
    def from_api(cls, payload: dict) -> "Tunables":
        return cls(
            yolo_fps=int(payload["yolo_fps"]),
            ocr_fps=int(payload["ocr_fps"]),
            detect_window_sec=int(payload["detect_window_sec"]),
            ocr_min_conf=float(payload["ocr_min_conf"]),
            dedup_iou=float(payload["dedup_iou"]),
            config_version=int(payload["config_version"]),
        )


@dataclass(frozen=True)
class Settings:
    """Static, boot-time configuration from the environment."""

    induk_url: str
    api_key: str
    camera_code: str
    rtsp_url: str
    outbox_db: Path
    snapshot_dir: Path
    video_dir: Path
    model_path: Path

    @classmethod
    def from_env(cls) -> "Settings":
        def _required(name: str) -> str:
            value = os.environ.get(name)
            if not value:
                raise RuntimeError(
                    f"{name} is not set. Copy edge/.env.example to edge/.env and fill it in."
                )
            return value

        return cls(
            induk_url=_required("SMART_GATE_INDUK_URL").rstrip("/"),
            api_key=_required("SMART_GATE_API_KEY"),
            camera_code=_required("SMART_GATE_CAMERA_CODE"),
            rtsp_url=_required("SMART_GATE_RTSP_URL"),
            outbox_db=Path(os.environ.get("SMART_GATE_OUTBOX_DB", "./outbox.db")),
            snapshot_dir=Path(os.environ.get("SMART_GATE_SNAPSHOT_DIR", "./snapshots")),
            video_dir=Path(os.environ.get("SMART_GATE_VIDEO_DIR", "./video")),
            model_path=Path(os.environ.get("SMART_GATE_MODEL_PATH", "./model.pt")),
        )


class TunableStore:
    """Thread-safe holder for the current Tunables.

    Readers get a consistent snapshot; writers swap the whole object. Never
    expose a setter for an individual field -- that would reintroduce the
    torn-read problem this class exists to prevent.
    """

    def __init__(self, initial: Tunables | None = None) -> None:
        self._value = initial or Tunables()
        self._lock = threading.Lock()

    def get(self) -> Tunables:
        with self._lock:
            return self._value

    def swap(self, new_value: Tunables) -> None:
        with self._lock:
            self._value = new_value

    def mark_applied(self, config_version: int) -> None:
        with self._lock:
            self._value = replace(self._value, config_version=config_version)
```

---

## 9.4 [DONE] `edge/agent/capture.py`

```python
"""RTSP capture into a shallow ring buffer (docs/edge-system/SRS.md §3.1).

The buffer is deliberately shallow (depth 2-3): processing must always work close
to live rather than draining a backlog. Dropping frames when inference falls
behind is acceptable -- there is no "process every frame" requirement.

One capture, many consumers: the inference loop, the live-view WHIP push, and the
local video writer all read this same buffer. Opening a second RTSP connection
would risk exceeding the camera's concurrent-client limit (SRS §11).
"""

from __future__ import annotations

import threading
import time
from collections import deque

import cv2

from agent.backoff import backoff_delay

RING_DEPTH = 3


class FrameRing:
    """Most-recent-frames buffer, safe for one writer and many readers."""

    def __init__(self, depth: int = RING_DEPTH) -> None:
        self._frames: deque = deque(maxlen=depth)
        self._lock = threading.Lock()
        self._updated = threading.Condition(self._lock)
        self._seq = 0

    def push(self, frame) -> None:
        with self._updated:
            self._seq += 1
            self._frames.append((self._seq, frame))
            self._updated.notify_all()

    def latest(self):
        """Newest ``(seq, frame)``, or ``(0, None)`` if nothing captured yet."""
        with self._lock:
            return self._frames[-1] if self._frames else (0, None)

    def wait_for_new(self, last_seq: int, timeout: float = 1.0):
        """Block until a frame newer than ``last_seq`` arrives, or time out."""
        with self._updated:
            if self._frames and self._frames[-1][0] > last_seq:
                return self._frames[-1]
            self._updated.wait(timeout=timeout)
            if self._frames and self._frames[-1][0] > last_seq:
                return self._frames[-1]
            return (last_seq, None)


class CaptureThread(threading.Thread):
    """Reads the camera continuously, reconnecting with backoff on failure."""

    def __init__(self, source: str, ring: FrameRing) -> None:
        super().__init__(name="capture", daemon=True)
        self.source = source
        self.ring = ring
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def run(self) -> None:
        attempt = 0
        while not self._stop.is_set():
            capture = cv2.VideoCapture(self.source)
            # Keep OpenCV's own buffer at 1 so we read live frames, not stale ones.
            capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if not capture.isOpened():
                attempt += 1
                delay = backoff_delay(attempt)
                print(f"capture: cannot open {self.source}; retrying in {delay:.1f}s")
                capture.release()
                self._stop.wait(timeout=delay)
                continue

            print(f"capture: connected to {self.source}")
            attempt = 0
            while not self._stop.is_set():
                ok, frame = capture.read()
                if not ok:
                    print("capture: stream ended or read failed; reconnecting")
                    break
                self.ring.push(frame)
            capture.release()

        print("capture: stopped")
```

> `cv2.VideoCapture` accepts a filesystem path exactly as it accepts an RTSP URL, which is what
> makes the Section 11 acceptance test possible: point `SMART_GATE_RTSP_URL` at a clip in
> `data/01-playlist/` and the agent runs unmodified.

---

## 9.5 [DONE] `edge/agent/induk_client.py`

```python
"""HTTP client for the induk API (docs/edge-system/API_CONTRACT.md §1).

The only thing in the agent that knows the induk exists. Never logs the
Authorization header (SRS §6 Security NFR).
"""

from __future__ import annotations

import requests

from agent.config import Settings

DEFAULT_TIMEOUT_SEC = 15


class IndukClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._session = requests.Session()
        self._session.headers.update({"Authorization": f"Bearer {settings.api_key}"})

    def _url(self, path: str) -> str:
        return f"{self._settings.induk_url}/api{path}"

    def get_config(self) -> dict:
        r = self._session.get(self._url("/edge/config"), timeout=DEFAULT_TIMEOUT_SEC)
        r.raise_for_status()
        return r.json()

    def heartbeat(
        self, *, agent_version: str, applied_config_version: int,
        local_queue_depth: int, status: str = "online",
    ) -> dict:
        r = self._session.post(
            self._url("/edge/heartbeat"),
            json={
                "agent_version": agent_version,
                "applied_config_version": applied_config_version,
                "local_queue_depth": local_queue_depth,
                "status": status,
            },
            timeout=DEFAULT_TIMEOUT_SEC,
        )
        r.raise_for_status()
        return r.json()

    def submit_crossing(
        self, *, idempotency_key: str, payload_json: str, snapshot_path: str | None
    ) -> requests.Response:
        """Submit one crossing. Returns the raw response -- the outbox decides
        what a non-2xx means (SRS §4.2: everything retries, nothing is dropped)."""
        files = None
        handle = None
        try:
            if snapshot_path:
                handle = open(snapshot_path, "rb")
                files = {"snapshot": ("crop.jpg", handle, "image/jpeg")}
            return self._session.post(
                self._url("/edge/crossings"),
                headers={"Idempotency-Key": idempotency_key},
                data={"payload": payload_json},
                files=files,
                timeout=DEFAULT_TIMEOUT_SEC,
            )
        finally:
            if handle is not None:
                handle.close()

    def poll_live_session(self, wait_seconds: int) -> dict:
        """Long-poll for a live-view action. Timeout allows for the server hold."""
        r = self._session.get(
            self._url("/edge/live-session"),
            params={"wait": wait_seconds},
            timeout=wait_seconds + DEFAULT_TIMEOUT_SEC,
        )
        r.raise_for_status()
        return r.json()
```

---

## Acceptance for Section 09

- [ ] `cd edge && uv run pytest tests/test_backoff.py -q` passes.
- [ ] `python -c "from agent.config import Settings, Tunables, TunableStore"` succeeds from
      `edge/` with a populated `.env`.
- [ ] `agent/` contains no `import app.` anywhere: `grep -rn "^from app\.\|^import app\." edge/`
      returns nothing.
