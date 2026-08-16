"""Edge-facing device API (``docs/edge-system/API_CONTRACT.md`` §1).

Called only by the 4 Jetson agents, never by the dashboard frontend. Every route
requires a per-device API key and returns 401 otherwise.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.core.config import (
    EDGE_CHOICE_DEFAULTS,
    LIVE_SESSION_DEFAULT_WAIT_SEC,
    LIVE_SESSION_MAX_WAIT_SEC,
)
from app.repositories import edge_repo, truck_master_repo
from app.schemas.edge import CrossingPayload, HeartbeatRequest
from app.services import edge_ingest, live_sessions
from app.services.edge_devices import authenticate_device
from app.utils.timeutil import utc_now_iso

router = APIRouter(tags=["edge"])

# Tunables the device is allowed to know about (API_CONTRACT §1.1).
_CONFIG_FIELDS = (
    "yolo_fps", "ocr_fps", "detect_window_sec", "ocr_min_conf", "dedup_iou",
    # Mounting geometry, owned by the core so an operator can correct a gate
    # that is recording every crossing backwards without touching the Jetson.
    "inbound_axis",
)


def _unprocessable(loc: list, msg: str, err_type: str = "value_error") -> HTTPException:
    """A 422 shaped like FastAPI's own validation errors.

    API_CONTRACT §0 carves out Pydantic-style failures from the ``{"error": ...}``
    convention: they keep the framework's ``{"detail": [...]}`` envelope. A list
    detail passes through ``app/main.py``'s handler untouched.
    """
    return HTTPException(status_code=422, detail=[{"loc": loc, "msg": msg, "type": err_type}])


def _is_canonical_uuid4(value: str) -> bool:
    """Lowercase, hyphenated UUID v4 -- anything else is rejected (API_CONTRACT §0)."""
    try:
        parsed = uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        return False
    return parsed.version == 4 and str(parsed) == value.lower()


# --- §1.1 Config -------------------------------------------------------------

@router.get("/edge/config")
def get_edge_config(device: dict = Depends(authenticate_device)):
    """Current authoritative settings for the calling device.

    No ``direction`` here anymore: a gate is not pinned to inbound or outbound
    at the registry level, it decides per truck from its own virtual center
    line (agent/pipeline.py) and reports that with each crossing instead.
    """
    # .get with a default, not [] -- a camera row written before the
    # inbound_axis migration has no such key, and a device asking for its config
    # must not get a 500 for a column it is about to be told the default of.
    config = {field: device.get(field, EDGE_CHOICE_DEFAULTS.get(field))
              for field in _CONFIG_FIELDS}
    return {
        "camera_code": device["camera_code"],
        **config,
        "config_version": device["config_version"],
    }


# --- §1.2 Heartbeat ----------------------------------------------------------

@router.post("/edge/heartbeat")
def post_heartbeat(body: HeartbeatRequest, device: dict = Depends(authenticate_device)):
    """Record device health and tell the agent whether to re-fetch config."""
    # Captured before the write: the comparison must use the version that was
    # current when this heartbeat arrived.
    current_version = int(device["config_version"])
    camera_code = device["camera_code"]
    now = utc_now_iso()

    edge_repo.apply_heartbeat(
        camera_code,
        status=body.status,
        local_queue_depth=body.local_queue_depth,
        agent_version=body.agent_version,
        applied_config_version=body.applied_config_version,
        now_iso=now,
    )

    config_changed = current_version != body.applied_config_version
    if not config_changed:
        # The device is running the current version -- stamp the "settings saved"
        # timestamp the dashboard shows. The repo's WHERE guard makes this a no-op
        # if the version moved on in between (SRS §5.3).
        edge_repo.mark_config_applied(camera_code, body.applied_config_version, now)

    return {
        "status": "success",
        "config_version": current_version,
        "config_changed": config_changed,
    }


# --- §1.3 Crossing submission ------------------------------------------------

@router.post("/edge/crossings")
async def post_crossing(
    payload: str = Form(...),
    snapshot: UploadFile | None = File(default=None),
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    device: dict = Depends(authenticate_device),
):
    """Submit one completed Detection Window's consensus result (SRS §3.2-§3.4)."""
    if not _is_canonical_uuid4(idempotency_key):
        raise _unprocessable(
            ["header", "Idempotency-Key"], "must be a lowercase, hyphenated UUID v4"
        )

    try:
        parsed = CrossingPayload.model_validate_json(payload)
    except ValidationError as err:
        raise HTTPException(status_code=422, detail=err.errors()) from err

    if parsed.camera_code != device["camera_code"]:
        raise _unprocessable(
            ["body", "payload", "camera_code"], "does not match the authenticated device"
        )

    try:
        datetime.fromisoformat(parsed.detected_at)
    except ValueError as err:
        raise _unprocessable(
            ["body", "payload", "detected_at"], "must be an ISO 8601 timestamp"
        ) from err

    if parsed.read_count == 0 and parsed.votes:
        raise _unprocessable(
            ["body", "payload", "votes"], "must be empty when read_count is 0"
        )

    raw = await snapshot.read() if snapshot is not None else None
    if edge_ingest.snapshot_required(parsed) and not raw:
        raise _unprocessable(
            ["body", "snapshot"], "required unless hull_id is UNKNOWN and read_count is 0"
        )

    crossing_id, created = edge_ingest.record_crossing(
        payload=parsed,
        camera_id=int(device["id"]),
        idempotency_key=idempotency_key,
        snapshot=raw,
        # The device's own per-crossing reading, from its virtual center line --
        # no gate is pinned to a fixed direction anymore. Selects the matching
        # strategy too: an outbound reading tries the trucks currently in the
        # pit before the full master.
        direction=parsed.direction,
    )

    if created:
        return JSONResponse(
            {"status": "success", "crossing_id": crossing_id}, status_code=201
        )
    return {"status": "success", "crossing_id": crossing_id, "duplicate": True}


# --- Master registry replication ---------------------------------------------

@router.get("/edge/master")
def get_master(known_version: int = 0, device: dict = Depends(authenticate_device)):
    """The truck master, for a device to replicate locally.

    Version-gated: a device passes the version it already holds and gets
    ``changed: false`` with no roster when it is current. The roster is small,
    but pulling it every few minutes over cellular for nothing is not free.

    Matching runs on the device against this replica so a gate keeps identifying
    trucks while the link here is down.
    """
    current = truck_master_repo.master_version()
    if known_version == current:
        return {"changed": False, "master_version": current}
    return {
        "changed": True,
        "master_version": current,
        "trucks": [
            {
                "hull_id": t["hull_id"],
                "hull_code": t["hull_code"],
                "contractor": t.get("contractor"),
                "unit_type": t.get("unit_type"),
                "brand": t.get("brand"),
                "model_type": t.get("model_type"),
                "year": t.get("year"),
                "status": t.get("status"),
            }
            for t in truck_master_repo.list_all()
        ],
    }


# --- §1.4 Live-session long-poll ---------------------------------------------

@router.get("/edge/live-session")
def get_live_session(
    wait: int = LIVE_SESSION_DEFAULT_WAIT_SEC,
    device: dict = Depends(authenticate_device),
):
    """Long-poll control channel for live view (API_CONTRACT §1.4).

    The agent holds this open and immediately reopens it on every response.
    ``wait`` is clamped rather than rejected, to tolerate a slightly misconfigured
    agent.
    """
    wait = max(0, min(int(wait), LIVE_SESSION_MAX_WAIT_SEC))
    return live_sessions.wait_for_action(device["camera_code"], wait)
