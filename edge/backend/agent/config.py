"""Agent configuration: static env settings + hot-swappable device tunables.

The tunables object is IMMUTABLE and replaced by reference, never mutated in place
(``docs/edge-system/SRS.md`` §3.1, §6 thread safety). That is what guarantees the
inference loop never reads a half-updated config mid-frame.
"""

from __future__ import annotations

import os
import threading
from dataclasses import dataclass, replace
from pathlib import Path

try:  # python-dotenv is optional at import time so tests need no .env
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover - dotenv missing in a bare test env
    pass

# --- Code constants (PRD §9: NOT device settings) -----------------------------
OCR_MIN_AREA = 400                  # px^2, matches labs/custom_model/video_processor.py
DETECT_TRIGGER_CONF = 0.30          # min YOLO conf to open a Detection Window
# Close a window this long after the last qualifying detection.
#
# Measured, not guessed. Across the ten reference clips the plate goes unseen
# mid-pass for up to 1.87s (dust, angle, motion blur) while the truck is still
# crossing; every other gap is under 0.75s. At the previous 1.5s that single
# 1.87s gap split one truck into two crossings -- the second window catching
# only the cab's CAT badge, which voted to UNIDENTIFIED and inflated the
# crossing count.
#
# 2.5s clears the observed worst case with margin. The opposite failure -- two
# trucks merged into one window -- needs consecutive plates less than 2.5s
# apart, which is far tighter than any gate throughput here (observed cycles are
# minutes apart). Re-measure with agent/../scripts if the camera angle changes.
NO_DETECTION_GRACE_SEC = 2.5
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
    """Thread-safe holder for the current :class:`Tunables`.

    Readers get a consistent snapshot; writers swap the whole object. There is
    deliberately no setter for an individual field -- that would reintroduce the
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
