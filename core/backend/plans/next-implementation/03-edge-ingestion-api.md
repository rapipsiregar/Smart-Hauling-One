# Section 03 — Edge-Facing Ingestion API (`/api/edge/*`)

**Goal:** the 4 Jetsons can fetch config, heartbeat, and submit consensus-voted crossings.
**Depends on:** [02](./02-device-auth.md). **Blocks:** 06, 09.

Implements `docs/edge-system/API_CONTRACT.md` §1.1–§1.3 and `docs/system_logics/sys_uc_010.md`.
(`GET /edge/live-session`, §1.4, arrives in [Section 06](./06-live-view-orchestration.md) — it
shares a session store with the dashboard-facing routes.)

All routes inherit the `/api` prefix from `api_router`; do **not** add a second prefix.

---

## 3.1 [DONE] Create `app/schemas/edge.py`

**New file.**

```python
"""Request models for the edge-facing API (docs/edge-system/API_CONTRACT.md §1).

snake_case field names, matching every other schema in this package. The
camelCase in ``build_cctv_detections`` is a historical exception for one legacy
view -- do not copy that pattern here.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class HeartbeatRequest(BaseModel):
    """POST /api/edge/heartbeat body (API_CONTRACT §1.2)."""

    model_config = ConfigDict(extra="ignore")

    agent_version: str
    applied_config_version: int = Field(ge=0)
    local_queue_depth: int = Field(ge=0)
    # A device never reports 'offline' about itself -- that is inferred centrally
    # from missed heartbeats (SRS §5.1). Pydantic rejects it with a 422.
    status: Literal["online", "maintenance"]


class VoteEntry(BaseModel):
    """One consensus cluster from fuzzy_vote_distribution (API_CONTRACT §1.3)."""

    model_config = ConfigDict(extra="ignore")

    text: str
    count: int = Field(ge=0)
    avg_ocr_conf: float = Field(ge=0.0, le=1.0)


class CrossingPayload(BaseModel):
    """The ``payload`` form field of POST /api/edge/crossings (API_CONTRACT §1.3)."""

    model_config = ConfigDict(extra="ignore")

    camera_code: str
    detected_at: str                       # ISO 8601 UTC, Detection Window close time
    window_sec: float = Field(ge=0.0)
    hull_id: str
    confidence: float = Field(ge=0.0, le=1.0)
    read_count: int = Field(ge=0)
    votes: list[VoteEntry]


class LiveSessionRef(BaseModel):
    """Body of /live/heartbeat and /live/stop (API_CONTRACT §2.4)."""

    model_config = ConfigDict(extra="ignore")

    session_id: str
```

---

## 3.2 [DONE] Create `app/services/edge_ingest.py`

Business logic, so the router stays thin (matching this codebase's routers-call-services shape).

**New file.**

```python
"""Crossing ingestion from edge devices (docs/edge-system/SRS.md §3.4, §5.2).

Edge crossings land in the same ``video_results`` table as the batch pipeline --
a new producer into one store, not a parallel data model (SRS §9). They are
distinguished by ``source = 'edge'``.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.core.config import SNAPSHOT_DIR
from app.repositories import run_write_repo
from app.schemas.edge import CrossingPayload
from app.services.dataset import invalidate_cache
from app.utils.paths import relative_to_root


def synthetic_video_name(camera_code: str, idempotency_key: str) -> str:
    """The ``video`` identifier for an edge crossing.

    Edge crossings have no file in data/01-playlist -- this is a stable synthetic
    id, unique because idempotency_key is a UUID v4. The .jpg suffix is for
    readability only; nothing parses it as a real file.
    """
    return f"edge-{camera_code}-{idempotency_key}.jpg"


def save_snapshot(video_name: str, raw: bytes) -> str | None:
    """Persist a crossing snapshot where the existing read path already looks.

    ``dataset.py::_snapshot_for`` globs ``{stem}__*.jpg`` inside SNAPSHOT_DIR, so
    naming the file ``{stem}__edge.jpg`` makes it discoverable with zero changes
    to that function.
    """
    if not raw:
        return None
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    dest = SNAPSHOT_DIR / f"{Path(video_name).stem}__edge.jpg"
    dest.write_bytes(raw)
    return relative_to_root(dest)


def snapshot_required(payload: CrossingPayload) -> bool:
    """Every crossing carries a snapshot except the empty-window case (SRS §3.4).

    A window that produced zero reads has no crop to send; the crossing is still
    submitted so operators see that a truck passed unidentified.
    """
    return not (payload.hull_id == "UNKNOWN" and payload.read_count == 0)


def record_crossing(
    *, payload: CrossingPayload, camera_id: int, idempotency_key: str, snapshot: bytes | None
) -> tuple[int, bool]:
    """Persist one crossing idempotently. Returns ``(crossing_id, created)``.

    Fast path: an already-seen idempotency key returns the original row without
    touching disk. The UNIQUE index inside insert_edge_crossing is what actually
    guarantees no duplicate under a concurrent retry race (SRS §5.2).
    """
    existing = run_write_repo.find_by_idempotency_key(idempotency_key)
    if existing is not None:
        return existing, False

    video = synthetic_video_name(payload.camera_code, idempotency_key)
    snapshot_path = save_snapshot(video, snapshot) if snapshot else None

    crossing_id, created = run_write_repo.insert_edge_crossing(
        camera_id=camera_id,
        video=video,
        hull_id=payload.hull_id,
        confidence=payload.confidence,
        read_count=payload.read_count,
        snapshot_path=snapshot_path,
        idempotency_key=idempotency_key,
        window_sec=payload.window_sec,
        votes_json=json.dumps([v.model_dump() for v in payload.votes]),
        detected_at_iso=payload.detected_at,
    )
    if created:
        # build_dataset() is memoised; without this the new crossing would not
        # appear on the next GET /api/crossings poll.
        invalidate_cache()
    return crossing_id, created
```

---

## 3.3 [DONE] Create `app/routers/edge.py`

**New file.**

```python
"""Edge-facing device API (docs/edge-system/API_CONTRACT.md §1).

Called only by the 4 Jetson agents, never by the dashboard frontend. Every route
requires a per-device API key and returns 401 otherwise.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from pydantic import ValidationError

from app.repositories import edge_repo
from app.schemas.edge import CrossingPayload, HeartbeatRequest
from app.services import edge_ingest
from app.services.edge_devices import authenticate_device
from app.utils.timeutil import utc_now_iso

router = APIRouter(tags=["edge"])

# Tunables the device is allowed to know about (API_CONTRACT §1.1).
_CONFIG_FIELDS = (
    "yolo_fps", "ocr_fps", "detect_window_sec", "ocr_min_conf", "dedup_iou",
)


def _unprocessable(loc: list, msg: str, err_type: str = "value_error"):
    """A 422 shaped like FastAPI's own validation errors.

    API_CONTRACT §0 carves out Pydantic-style failures from the {"error": ...}
    convention: they keep the framework's {"detail": [...]} envelope. A list
    detail passes through app/main.py's handler untouched.
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
    """Current authoritative settings for the calling device."""
    config = {field: device[field] for field in _CONFIG_FIELDS}
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
        # timestamp the dashboard shows. The repo's WHERE guard makes this a
        # no-op if the version moved on in between (SRS §5.3).
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
            ["header", "Idempotency-Key"],
            "must be a lowercase, hyphenated UUID v4",
        )

    try:
        parsed = CrossingPayload.model_validate_json(payload)
    except ValidationError as err:
        raise HTTPException(status_code=422, detail=err.errors()) from err

    if parsed.camera_code != device["camera_code"]:
        raise _unprocessable(
            ["body", "payload", "camera_code"],
            "does not match the authenticated device",
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
            ["body", "snapshot"],
            "required unless hull_id is UNKNOWN and read_count is 0",
        )

    crossing_id, created = edge_ingest.record_crossing(
        payload=parsed,
        camera_id=int(device["id"]),
        idempotency_key=idempotency_key,
        snapshot=raw,
    )

    if created:
        return JSONResponse(
            {"status": "success", "crossing_id": crossing_id}, status_code=201
        )
    return {"status": "success", "crossing_id": crossing_id, "duplicate": True}
```

Add `from fastapi.responses import JSONResponse` to the imports (used for the 201).

---

## 3.4 [DONE] Register the router

**File:** `app/routers/__init__.py`

```python
from app.routers import analysis, cameras, dashboard, edge, reference, testbench

api_router = APIRouter(prefix="/api")
api_router.include_router(dashboard.router)
api_router.include_router(analysis.router)
api_router.include_router(reference.router)
api_router.include_router(cameras.router)
api_router.include_router(testbench.router)
api_router.include_router(edge.router)
```

---

## 3.5 [DONE] Tests

**New file:** `tests/test_edge_crossings.py`

```python
"""Edge crossing ingestion: TC-010-01, TC-010-02, TC-010-03."""

from __future__ import annotations

import json
import uuid

import pytest

from app.core.config import SNAPSHOT_DIR
from app.services.dataset import build_dataset, invalidate_cache
from tests.conftest import EDGE_TEST_CODE

FAKE_JPEG = b"\xff\xd8\xff\xe0" + b"pytest-not-a-real-jpeg" + b"\xff\xd9"


def _payload(**overrides) -> str:
    body = {
        "camera_code": EDGE_TEST_CODE,
        "detected_at": "2026-08-02T14:31:02Z",
        "window_sec": 5.8,
        "hull_id": "DT-118",
        "confidence": 0.94,
        "read_count": 9,
        "votes": [
            {"text": "DT-118", "count": 6, "avg_ocr_conf": 0.91},
            {"text": "DT118", "count": 2, "avg_ocr_conf": 0.85},
        ],
    }
    body.update(overrides)
    return json.dumps(body)


def _submit(client, headers, *, key=None, payload=None, snapshot=FAKE_JPEG):
    key = key or str(uuid.uuid4())
    files = {"snapshot": ("crop.jpg", snapshot, "image/jpeg")} if snapshot else None
    return client.post(
        "/api/edge/crossings",
        headers={**headers, "Idempotency-Key": key},
        data={"payload": payload or _payload()},
        files=files,
    ), key


def test_new_crossing_returns_201(client, edge_camera, auth_headers):
    r, _ = _submit(client, auth_headers)
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "success"
    assert isinstance(body["crossing_id"], int)


def test_duplicate_key_returns_200_and_same_id(client, edge_camera, auth_headers):
    first, key = _submit(client, auth_headers)
    assert first.status_code == 201

    second, _ = _submit(client, auth_headers, key=key)
    assert second.status_code == 200
    assert second.json()["duplicate"] is True
    assert second.json()["crossing_id"] == first.json()["crossing_id"]


def test_empty_window_accepted_without_snapshot(client, edge_camera, auth_headers):
    r, _ = _submit(
        client,
        auth_headers,
        payload=_payload(hull_id="UNKNOWN", confidence=0.0, read_count=0, votes=[]),
        snapshot=None,
    )
    assert r.status_code == 201


def test_missing_snapshot_rejected_when_required(client, edge_camera, auth_headers):
    r, _ = _submit(client, auth_headers, snapshot=None)
    assert r.status_code == 422


def test_malformed_payload_rejected(client, edge_camera, auth_headers):
    r, _ = _submit(client, auth_headers, payload='{"camera_code": "x"}')
    assert r.status_code == 422


def test_non_uuid4_idempotency_key_rejected(client, edge_camera, auth_headers):
    r, _ = _submit(client, auth_headers, key="not-a-uuid")
    assert r.status_code == 422


def test_camera_code_mismatch_rejected(client, edge_camera, auth_headers):
    r, _ = _submit(client, auth_headers, payload=_payload(camera_code="SOME-OTHER-GATE"))
    assert r.status_code == 422


def test_snapshot_lands_where_the_read_path_looks(client, edge_camera, auth_headers):
    r, key = _submit(client, auth_headers)
    assert r.status_code == 201
    stem = f"edge-{EDGE_TEST_CODE}-{key}"
    assert list(SNAPSHOT_DIR.glob(f"{stem}__*.jpg")), "snapshot not discoverable by _snapshot_for"


def test_crossing_is_attributed_to_the_submitting_camera(client, edge_camera, auth_headers):
    r, key = _submit(client, auth_headers)
    assert r.status_code == 201
    invalidate_cache()

    video = f"edge-{EDGE_TEST_CODE}-{key}.jpg"
    match = [c for c in build_dataset()["crossings"] if c["video"] == video]
    assert len(match) == 1
    # Depends on the Section 01.4 attribution fix -- without it this reads
    # "Unassigned Gate".
    assert match[0]["camera_code"] == EDGE_TEST_CODE
```

**New file:** `tests/test_edge_heartbeat.py`

```python
"""Heartbeat and config endpoints: TC-010-05, TC-010-06."""

from __future__ import annotations

from app.services import cameras as cam
from tests.conftest import EDGE_TEST_CODE


def _beat(client, headers, *, applied=1, status="online", queue=0, version="1.0.0"):
    return client.post(
        "/api/edge/heartbeat",
        headers=headers,
        json={
            "agent_version": version,
            "applied_config_version": applied,
            "local_queue_depth": queue,
            "status": status,
        },
    )


def test_config_returns_the_contract_shape(client, edge_camera, auth_headers):
    body = client.get("/api/edge/config", headers=auth_headers).json()
    assert set(body) == {
        "camera_code", "yolo_fps", "ocr_fps", "detect_window_sec",
        "ocr_min_conf", "dedup_iou", "config_version",
    }
    assert body["yolo_fps"] == 20      # PRD §9 defaults
    assert body["ocr_fps"] == 4
    assert body["detect_window_sec"] == 6


def test_heartbeat_brings_device_online(client, edge_camera, auth_headers):
    assert edge_camera["status"] == "offline"
    r = _beat(client, auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "success"

    refreshed = cam.get_camera(EDGE_TEST_CODE)
    assert refreshed["status"] == "online"
    assert refreshed["last_heartbeat_at"] is not None
    assert refreshed["agent_version"] == "1.0.0"


def test_heartbeat_records_queue_depth(client, edge_camera, auth_headers):
    _beat(client, auth_headers, queue=17)
    assert cam.get_camera(EDGE_TEST_CODE)["local_queue_depth"] == 17


def test_maintenance_status_accepted(client, edge_camera, auth_headers):
    _beat(client, auth_headers, status="maintenance")
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "maintenance"


def test_device_may_not_self_report_offline(client, edge_camera, auth_headers):
    # SRS §5.1: offline is inferred centrally, never claimed by the device.
    assert _beat(client, auth_headers, status="offline").status_code == 422


def test_config_changed_false_when_versions_match(client, edge_camera, auth_headers):
    body = _beat(client, auth_headers, applied=1).json()
    assert body["config_version"] == 1
    assert body["config_changed"] is False

    refreshed = cam.get_camera(EDGE_TEST_CODE)
    assert refreshed["applied_config_version"] == 1
    assert refreshed["last_config_applied_at"] is not None


def test_config_changed_true_when_device_is_stale(client, edge_camera, auth_headers):
    body = _beat(client, auth_headers, applied=0).json()
    assert body["config_changed"] is True
    # Reported verbatim even while stale -- this is what drives the dashboard's
    # "pending" indicator.
    assert cam.get_camera(EDGE_TEST_CODE)["applied_config_version"] == 0
    assert cam.get_camera(EDGE_TEST_CODE)["last_config_applied_at"] is None
```

---

## Acceptance for Section 03

- [ ] `uv run pytest tests/test_edge_auth.py tests/test_edge_crossings.py tests/test_edge_heartbeat.py -q`
      all pass (Section 02's auth tests are unblocked by this section).
- [ ] `uv run pytest tests/ -q` shows no new failures vs. the Section 00 baseline.
- [ ] `GET /docs` lists the three `/api/edge/*` routes.
