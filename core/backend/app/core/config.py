"""Central configuration: filesystem paths, constants, and validation sets.

Every module reads paths and tunables from here instead of recomputing
``Path(__file__).parent.parent`` in a dozen places. ``ROOT`` is the project
root (three levels up from this file: ``app/core/config.py`` -> project root).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# --- Roots -------------------------------------------------------------------

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
LABS_DIR = ROOT / "labs"

# The OCR pipeline lives in ``labs/`` and is imported as ``custom_model.*``.
if str(LABS_DIR) not in sys.path:
    sys.path.append(str(LABS_DIR))

# --- Data stores -------------------------------------------------------------

DB_PATH = DATA_DIR / "smart_gate.db"
RESULTS_JSON = DATA_DIR / "12-run-custom-model-results.json"
REGISTERED_TRUCKS_JSON = DATA_DIR / "registered_trucks.json"
SYNC_LOG = DATA_DIR / "sync_ritase.json"


# --- Media directories -------------------------------------------------------

PLAYLIST_DIR = DATA_DIR / "01-playlist"
SNAPSHOT_DIR = DATA_DIR / "12-plate-snapshots"
ANNOTATED_DIR = DATA_DIR / "12-annotated-videos"
UPLOAD_DIR = DATA_DIR / "web-uploads"
WEB_RESULTS_DIR = DATA_DIR / "web-results"

# --- Model -------------------------------------------------------------------

AI_MODEL_DIR = ROOT / "ai-model"
PREFERRED_MODEL_NAME = "pak-shomad-v2.pt"


def resolve_model_path() -> Path:
    """Locate the YOLO detector weights.

    Weights are gitignored and get re-trained under new names (``pak-shomad-v2``,
    ``truck-id-yolo26-det-v2-20260719``, ...), so a hardcoded filename breaks on
    every new drop. Resolution order:

    1. ``SMART_GATE_MODEL_PATH`` -- explicit override, wins always.
    2. ``ai-model/pak-shomad-v2.pt`` -- the historical name, for existing setups.
    3. The most recently modified ``*.pt`` in ``ai-model/``.

    ``is_file()`` guards matter: an unzipped checkpoint can leave a *directory*
    named ``something.pt`` in place, which must never be selected.
    """
    override = os.environ.get("SMART_GATE_MODEL_PATH")
    if override:
        return Path(override)

    preferred = AI_MODEL_DIR / PREFERRED_MODEL_NAME
    if preferred.is_file():
        return preferred

    if AI_MODEL_DIR.is_dir():
        candidates = sorted(
            (p for p in AI_MODEL_DIR.glob("*.pt") if p.is_file()),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if candidates:
            return candidates[0]

    return preferred  # honest default: the path we looked for and did not find


MODEL_PATH = resolve_model_path()

# Shown when no processing run has been recorded yet. Derived from the weights
# actually resolved above rather than written out by hand: the literal name here
# was "pak-shomad-v1.pt", a model retired two names ago, so a fresh database
# reported a detector that is not the one it would use.
DEFAULT_MODEL = MODEL_PATH.name

# --- Domain constants --------------------------------------------------------

ALLOWED_VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".avi", ".webm"}

# % vote confidence at or above which a crossing is treated as auto-reconciled.
RECONCILE_THRESHOLD = 95.0

# Hull-id sentinels that mean "not a real, identified truck".
UNIDENTIFIED_HULLS = {"UNKNOWN", "ERROR", ""}

# Operator-managed camera columns (identity + connection + ops metadata).
#
# No "direction" here: a gate is not pinned to inbound or outbound at the
# registry level anymore. Direction is decided per truck by the device's own
# virtual center line (edge/backend/agent/pipeline.py) and reported with each
# crossing instead -- see app/repositories/run_write_repo.py's
# video_results.direction column. The DB still carries a legacy
# cameras.direction column (always 'both' going forward) for old batch-run
# rows that predate that per-crossing column; see app/services/dataset.py.
CAMERA_FIELDS = (
    "camera_code", "name", "gate_location", "status",
    "rtsp_url", "ip_host", "username", "resolution", "fps",
    "folder", "install_date", "last_seen", "notes",
)
VALID_CAMERA_STATUS = {"online", "offline", "maintenance"}

# --- Edge device tunables (docs/edge-system/PRD.md §9) ------------------------

# Operator-tunable per device via PUT /api/cameras/{code}/edge-config. Kept out
# of CAMERA_FIELDS on purpose: identity edits must never touch config_version.
EDGE_TUNABLE_FIELDS = (
    "yolo_fps", "ocr_fps", "detect_window_sec", "ocr_min_conf", "dedup_iou",
)

# (min, max) inclusive. Authoritative server-side validation -- the settings form
# mirrors these client-side but the server rejects out-of-range values regardless.
EDGE_TUNABLE_RANGES = {
    "yolo_fps": (1, 30),            # business owner's preferred operating range: 18-25
    "ocr_fps": (1, 15),             # preferred: ~4
    "detect_window_sec": (1, 30),   # preferred: 5-7
    "ocr_min_conf": (0.0, 1.0),
    "dedup_iou": (0.0, 1.0),
}

EDGE_TUNABLE_DEFAULTS = {
    "yolo_fps": 20,
    "ocr_fps": 4,
    "detect_window_sec": 6,
    "ocr_min_conf": 0.30,
    "dedup_iou": 0.92,
}

HEARTBEAT_INTERVAL_SEC = 30              # docs/edge-system/SRS.md §3.5
OFFLINE_THRESHOLD_SEC = 90               # 3x heartbeat interval, SRS §5.1
LIVE_SESSION_MAX_WAIT_SEC = 30           # long-poll clamp, API_CONTRACT §1.4
LIVE_SESSION_DEFAULT_WAIT_SEC = 25       # long-poll default, API_CONTRACT §1.4
LIVE_SESSION_STALE_SEC = 20              # 2 missed viewer keep-alives, SRS §8.3


def ensure_directories() -> None:
    """Create writable directories the app relies on (idempotent)."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
