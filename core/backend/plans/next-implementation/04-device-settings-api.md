# Section 04 — Dashboard-Facing Device Settings & Health

**Goal:** an operator can read and tune each gate's inference settings, and see device health for
all 4 gates in one call.
**Depends on:** [01](./01-schema-foundations.md). **Blocks:** 08.

Implements `docs/edge-system/API_CONTRACT.md` §2.1–§2.3 and `docs/system_logics/sys_uc_008.md`.
These are additive sub-resources on the **existing** camera router — not a new router file.

**No auth.** See README decision #3: this spec assumes a single trusted operator, matching the
app's existing `/api/*`. Do not add auth here.

---

## 4.1 [DONE] Create `app/schemas/edge_config.py`

**New file.** Kept separate from `app/schemas/camera.py` on purpose: these fields must never be
accepted by `CameraCreate`/`CameraUpdate`, so a `PUT /api/cameras/{code}` can't touch
`config_version` (`docs/system_logics/sys_uc_008.md` §3 Security Rules).

```python
"""Request model for per-device edge tunables (API_CONTRACT §2.2).

Deliberately separate from app/schemas/camera.py: identity fields (name, folder,
rtsp_url) stay on PUT /api/cameras/{code}; tunables stay here. Merging them would
let an identity edit silently bump config_version.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class EdgeConfigUpdate(BaseModel):
    """Partial update -- every field optional, at least one required.

    Range validation lives in app/services/edge_config.py, not here, so the API
    can return the contract's exact message: "<field> must be between <lo> and
    <hi>" (API_CONTRACT §2.2) rather than a Pydantic 422.
    """

    model_config = ConfigDict(extra="ignore")

    yolo_fps: int | None = None
    ocr_fps: int | None = None
    detect_window_sec: int | None = None
    ocr_min_conf: float | None = None
    dedup_iou: float | None = None
```

---

## 4.2 [DONE] Create `app/services/edge_config.py`

**New file.**

```python
"""Per-device edge settings and health projection (API_CONTRACT §2.1-§2.3).

The dashboard's saved-vs-pending indicator is exactly
``applied_config_version == config_version``: the former is what the device last
reported via heartbeat, the latter is what an operator last saved. They differ
whenever a device has not yet picked up a change (SRS §5.3) -- which is a normal,
expected state for an offline device, not an error.
"""

from __future__ import annotations

from app.core.config import EDGE_TUNABLE_FIELDS, EDGE_TUNABLE_RANGES
from app.repositories import edge_repo
from app.services import cameras

# Never leave this module -- SRS §7.3 Security NFR.
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
    """Settings + health for one device, or None if the camera is unknown."""
    cam = cameras.get_camera(camera_code)
    return _health_projection(cam) if cam else None


def validate(payload: dict) -> str | None:
    """Return the first range violation's message, or None if all values are valid.

    Checked in EDGE_TUNABLE_FIELDS order so the message is deterministic.
    API_CONTRACT §2.2: "one message per first-failing field is sufficient."
    """
    for field in EDGE_TUNABLE_FIELDS:
        if field not in payload:
            continue
        value = payload[field]
        low, high = EDGE_TUNABLE_RANGES[field]
        if value is None or not isinstance(value, (int, float)) or isinstance(value, bool):
            return f"{field} must be a number"
        if not (low <= value <= high):
            return f"{field} must be between {low} and {high}"
    return None


def update_edge_config(camera_code: str, payload: dict) -> tuple[dict | None, str | None]:
    """Validate and persist tunables. Returns ``(projection, error_message)``.

    Exactly one of the two is non-None. A successful write bumps config_version
    by exactly 1 (BR-012); applied_config_version is untouched until the device
    confirms via heartbeat.
    """
    fields = {k: v for k, v in payload.items() if k in EDGE_TUNABLE_FIELDS}
    if not fields:
        return None, "At least one of "
        # (see the router -- it builds the full message; kept short here)

    error = validate(fields)
    if error:
        return None, error

    updated = edge_repo.update_edge_config(camera_code, fields)
    if updated is None:
        return None, None  # camera not found -- router turns this into a 404
    return _health_projection(updated), None


def attach_health_fields(cam: dict) -> dict:
    """Camera row + edge health fields, for the extended GET /api/cameras (§2.3).

    Additive: every existing key (including ``status``) is preserved, because
    existing frontend callers read them. ``api_key_hash`` is stripped -- it must
    never be returned by any read endpoint (SRS §7.3).
    """
    enriched = {k: v for k, v in cam.items() if k not in _SECRET_FIELDS}
    enriched["device_status"] = cam["status"]
    enriched["applied_config_version"] = cam.get("applied_config_version", 0)
    return enriched
```

Replace the placeholder in `update_edge_config`'s empty-fields branch with the real message:

```python
    fields = {k: v for k, v in payload.items() if k in EDGE_TUNABLE_FIELDS}
    if not fields:
        return None, "At least one settings field is required"
```

---

## 4.3 [DONE] Add the routes

**File:** `app/routers/cameras.py`

Add imports:
```python
from app.schemas.edge_config import EdgeConfigUpdate
from app.services import edge_config
```

Replace `list_cameras` and append the two new routes:

```python
@router.get("/cameras")
def list_cameras():
    """All cameras, each enriched with edge health/config summary fields.

    Powers the fleet-wide device-health widget in one call instead of N
    per-camera requests (API_CONTRACT §2.3). Existing fields are unchanged.
    """
    return [edge_config.attach_health_fields(c) for c in cameras.list_cameras()]
```

```python
@router.get("/cameras/{camera_code}/edge-config")
def get_edge_config(camera_code: str):
    cfg = edge_config.get_edge_config(camera_code)
    if cfg is None:
        return JSONResponse({"error": "Camera not found"}, status_code=404)
    return cfg


@router.put("/cameras/{camera_code}/edge-config")
def put_edge_config(camera_code: str, payload: EdgeConfigUpdate):
    """Save per-device tunables. Increments config_version by exactly 1.

    Ranges are validated before the camera is looked up, so a malformed request
    fails identically whether or not the camera_code happens to exist. Saving for
    an offline device is expected to succeed -- the change simply stays pending
    until that device reconnects (userflow_uc_008 AF-002).
    """
    updated, error = edge_config.update_edge_config(
        camera_code, payload.model_dump(exclude_unset=True)
    )
    if error:
        return JSONResponse({"error": error}, status_code=400)
    if updated is None:
        return JSONResponse({"error": "Camera not found"}, status_code=404)
    return updated
```

> **Route ordering matters.** FastAPI matches in declaration order, and
> `/cameras/{camera_code}` would swallow `/cameras/{camera_code}/edge-config` only if the latter
> were declared with a path that the former could match — it can't here (different segment count),
> so declaration order is safe either way. Keep the new routes after the existing CRUD block for
> readability.

**Check the file length** afterwards (`wc -l app/routers/cameras.py`): it starts at 63 and grows to
roughly 110 — well under 400.

---

## 4.4 [DONE] Tests

**New file:** `tests/test_edge_config_api.py`

```python
"""Dashboard-facing device settings: TC-008-01 through TC-008-06."""

from __future__ import annotations

import pytest

from app.core.config import EDGE_TUNABLE_RANGES
from tests.conftest import EDGE_TEST_CODE

EXPECTED_KEYS = {
    "camera_code", "yolo_fps", "ocr_fps", "detect_window_sec", "ocr_min_conf",
    "dedup_iou", "config_version", "device_status", "agent_version",
    "last_heartbeat_at", "last_config_applied_at", "applied_config_version",
    "local_queue_depth",
}


def test_get_returns_contract_shape_with_defaults(client, edge_camera):
    r = client.get(f"/api/cameras/{EDGE_TEST_CODE}/edge-config")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == EXPECTED_KEYS
    assert body["yolo_fps"] == 20
    assert body["ocr_fps"] == 4
    assert body["detect_window_sec"] == 6
    assert body["ocr_min_conf"] == 0.30
    assert body["dedup_iou"] == 0.92
    assert body["config_version"] == 1
    assert body["applied_config_version"] == 0     # never heartbeated
    assert body["device_status"] == "offline"


def test_get_unknown_camera_404(client):
    r = client.get("/api/cameras/PYTEST-NO-SUCH-GATE/edge-config")
    assert r.status_code == 404
    assert r.json() == {"error": "Camera not found"}


def test_put_saves_and_bumps_config_version(client, edge_camera):
    r = client.put(
        f"/api/cameras/{EDGE_TEST_CODE}/edge-config",
        json={"yolo_fps": 22, "ocr_fps": 5, "detect_window_sec": 5},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["yolo_fps"] == 22
    assert body["ocr_fps"] == 5
    assert body["detect_window_sec"] == 5
    assert body["config_version"] == 2             # exactly +1 (BR-012)
    # Unchanged until the device confirms -> UI shows "pending".
    assert body["applied_config_version"] == 0


def test_put_partial_update_leaves_other_fields_alone(client, edge_camera):
    client.put(f"/api/cameras/{EDGE_TEST_CODE}/edge-config", json={"yolo_fps": 25})
    body = client.get(f"/api/cameras/{EDGE_TEST_CODE}/edge-config").json()
    assert body["yolo_fps"] == 25
    assert body["ocr_fps"] == 4                    # untouched


def test_put_empty_body_400(client, edge_camera):
    r = client.put(f"/api/cameras/{EDGE_TEST_CODE}/edge-config", json={})
    assert r.status_code == 400
    assert "error" in r.json()
    # No write happened.
    assert client.get(f"/api/cameras/{EDGE_TEST_CODE}/edge-config").json()["config_version"] == 1


def test_put_unknown_camera_404(client):
    r = client.put("/api/cameras/PYTEST-NO-SUCH-GATE/edge-config", json={"yolo_fps": 20})
    assert r.status_code == 404


@pytest.mark.parametrize("field,bad_value", [
    ("yolo_fps", 0), ("yolo_fps", 31),
    ("ocr_fps", 0), ("ocr_fps", 16),
    ("detect_window_sec", 0), ("detect_window_sec", 31),
    ("ocr_min_conf", -0.1), ("ocr_min_conf", 1.1),
    ("dedup_iou", -0.1), ("dedup_iou", 1.1),
])
def test_out_of_range_rejected_with_field_message(client, edge_camera, field, bad_value):
    r = client.put(f"/api/cameras/{EDGE_TEST_CODE}/edge-config", json={field: bad_value})
    assert r.status_code == 400
    low, high = EDGE_TUNABLE_RANGES[field]
    assert r.json() == {"error": f"{field} must be between {low} and {high}"}
    # A rejected write must not bump the version (TC-008-04).
    assert client.get(f"/api/cameras/{EDGE_TEST_CODE}/edge-config").json()["config_version"] == 1


@pytest.mark.parametrize("field,ok_value", [
    ("yolo_fps", 1), ("yolo_fps", 30),
    ("ocr_fps", 1), ("ocr_fps", 15),
    ("detect_window_sec", 1), ("detect_window_sec", 30),
    ("ocr_min_conf", 0.0), ("ocr_min_conf", 1.0),
    ("dedup_iou", 0.0), ("dedup_iou", 1.0),
])
def test_range_boundaries_accepted(client, edge_camera, field, ok_value):
    r = client.put(f"/api/cameras/{EDGE_TEST_CODE}/edge-config", json={field: ok_value})
    assert r.status_code == 200


def test_save_for_offline_device_succeeds(client, edge_camera):
    # TC-008-05 / userflow_uc_008 AF-002: pending is not failure.
    assert edge_camera["status"] == "offline"
    r = client.put(f"/api/cameras/{EDGE_TEST_CODE}/edge-config", json={"yolo_fps": 24})
    assert r.status_code == 200
    assert r.json()["config_version"] == 2
    assert r.json()["applied_config_version"] != r.json()["config_version"]


def test_list_cameras_carries_health_fields(client, edge_camera):
    rows = client.get("/api/cameras").json()
    row = next(c for c in rows if c["camera_code"] == EDGE_TEST_CODE)
    for key in ("device_status", "agent_version", "last_heartbeat_at",
                "local_queue_depth", "config_version", "applied_config_version"):
        assert key in row
    # Existing keys still present for current frontend callers.
    assert "status" in row and "name" in row
    # Secret never leaves the server (SRS §7.3).
    assert "api_key_hash" not in row
```

**New file:** `tests/test_edge_config_roundtrip.py`

Covers TC-008-02 → TC-008-03, the pending→saved transition that spans both APIs.

```python
"""Settings save -> device confirms -> UI shows saved (TC-008-02, TC-008-03)."""

from __future__ import annotations

from tests.conftest import EDGE_TEST_CODE


def _config(client):
    return client.get(f"/api/cameras/{EDGE_TEST_CODE}/edge-config").json()


def test_pending_until_device_confirms(client, edge_camera, auth_headers):
    # 1. Operator saves -> version 2, device still on 0 -> "pending".
    client.put(f"/api/cameras/{EDGE_TEST_CODE}/edge-config", json={"yolo_fps": 22})
    before = _config(client)
    assert before["config_version"] == 2
    assert before["applied_config_version"] != before["config_version"]

    # 2. Device heartbeats while still stale -> told to re-fetch.
    stale = client.post("/api/edge/heartbeat", headers=auth_headers, json={
        "agent_version": "1.0.0", "applied_config_version": 1,
        "local_queue_depth": 0, "status": "online",
    }).json()
    assert stale["config_changed"] is True
    assert stale["config_version"] == 2

    # 3. Device fetches the new config and gets the saved values.
    fetched = client.get("/api/edge/config", headers=auth_headers).json()
    assert fetched["yolo_fps"] == 22
    assert fetched["config_version"] == 2

    # 4. Device confirms on its next heartbeat -> "saved".
    confirmed = client.post("/api/edge/heartbeat", headers=auth_headers, json={
        "agent_version": "1.0.0", "applied_config_version": 2,
        "local_queue_depth": 0, "status": "online",
    }).json()
    assert confirmed["config_changed"] is False

    after = _config(client)
    assert after["applied_config_version"] == after["config_version"] == 2
    assert after["last_config_applied_at"] is not None
    assert after["device_status"] == "online"
```

---

## Acceptance for Section 04

- [ ] `uv run pytest tests/test_edge_config_api.py tests/test_edge_config_roundtrip.py -q` passes.
- [ ] `uv run pytest tests/ -q` shows no new failures — especially `test_response_contract.py`
      (`GET /api/cameras` has no frozen-shape test, but confirm nothing else regressed).
- [ ] `api_key_hash` appears in **no** API response anywhere.
