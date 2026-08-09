"""Per-device edge settings and health projection (API_CONTRACT §2.1-§2.3).

The dashboard's saved-vs-pending indicator is exactly
``applied_config_version == config_version``: the former is what the device last
reported via heartbeat, the latter is what an operator last saved. They differ
whenever a device has not yet picked up a change (SRS §5.3) -- a normal, expected
state for an offline device, not an error.
"""

from __future__ import annotations

from app.core.config import EDGE_TUNABLE_FIELDS, EDGE_TUNABLE_RANGES
from app.repositories import edge_repo
from app.services import cameras

# Never leaves this module -- SRS §7.3 Security NFR.
_SECRET_FIELDS = ("api_key_hash",)


def _health_projection(cam: dict) -> dict:
    """The health/config fields API_CONTRACT §2.1 specifies, from a camera row."""
    return {
        "camera_code": cam["camera_code"],
        "yolo_fps": cam["yolo_fps"],
        "ocr_fps": cam["ocr_fps"],
        "detect_window_sec": cam["detect_window_sec"],
        "ocr_min_conf": cam["ocr_min_conf"],
        "dedup_iou": cam["dedup_iou"],
        "config_version": cam["config_version"],
        # Reuses the existing Camera.status enum unmodified (SRS §5.1).
        "device_status": cam["status"],
        "agent_version": cam.get("agent_version"),
        "last_heartbeat_at": cam.get("last_heartbeat_at"),
        "last_config_applied_at": cam.get("last_config_applied_at"),
        "applied_config_version": cam.get("applied_config_version", 0),
        "local_queue_depth": cam.get("local_queue_depth", 0),
    }


def get_edge_config(camera_code: str) -> dict | None:
    """Settings + health for one device, or ``None`` if the camera is unknown."""
    cam = cameras.get_camera(camera_code)
    return _health_projection(cam) if cam else None


def validate(payload: dict) -> str | None:
    """Return the first range violation's message, or ``None`` if all values pass.

    Checked in ``EDGE_TUNABLE_FIELDS`` order so the message is deterministic.
    API_CONTRACT §2.2: "one message per first-failing field is sufficient."
    """
    for field in EDGE_TUNABLE_FIELDS:
        if field not in payload:
            continue
        value = payload[field]
        low, high = EDGE_TUNABLE_RANGES[field]
        if value is None or isinstance(value, bool) or not isinstance(value, (int, float)):
            return f"{field} must be a number"
        if not (low <= value <= high):
            return f"{field} must be between {low} and {high}"
    return None


def update_edge_config(camera_code: str, payload: dict) -> tuple[dict | None, str | None]:
    """Validate and persist tunables. Returns ``(projection, error_message)``.

    At most one of the two is non-None; ``(None, None)`` means the camera does not
    exist and the router should answer 404. A successful write bumps
    ``config_version`` by exactly 1 (BR-012); ``applied_config_version`` is
    untouched until the device confirms via heartbeat.
    """
    fields = {k: v for k, v in payload.items() if k in EDGE_TUNABLE_FIELDS}
    if not fields:
        return None, "At least one settings field is required"

    error = validate(fields)
    if error:
        return None, error

    updated = edge_repo.update_edge_config(camera_code, fields)
    if updated is None:
        return None, None  # camera not found -- router turns this into a 404
    return _health_projection(updated), None


def attach_health_fields(cam: dict) -> dict:
    """Camera row + edge health fields, for the extended ``GET /api/cameras`` (§2.3).

    Additive: every existing key (including ``status``) is preserved, because
    existing frontend callers read them. ``api_key_hash`` is stripped -- it must
    never be returned by any read endpoint (SRS §7.3).
    """
    enriched = {k: v for k, v in cam.items() if k not in _SECRET_FIELDS}
    enriched["device_status"] = cam["status"]
    enriched["applied_config_version"] = cam.get("applied_config_version", 0)
    return enriched
