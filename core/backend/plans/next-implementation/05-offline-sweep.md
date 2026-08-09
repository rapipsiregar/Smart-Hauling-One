# Section 05 — Offline Device Status Sweep

**Goal:** a device that stops heartbeating shows `offline` within ~90s, with no report from the
device itself.
**Depends on:** [01](./01-schema-foundations.md). **Blocks:** 08.

Implements `docs/edge-system/SRS.md` §5.1 and business rule BR-011. Covers TC-010-07.

> **There is no existing startup hook to copy.** `app/main.py::create_app()` has no
> `@app.on_event`, no `lifespan=`, no background threads. The "Automatic Database Backup Scheduler"
> in `docs/feature-list.md` §1.12 does not exist in this codebase. You are creating this mechanism,
> not imitating one. (The `threading.Thread` calls in `app/services/jobs.py` and `batch_runs.py`
> are per-request job workers — a different thing.)

---

## 5.1 [DONE] Create `app/services/device_status.py`

**New file.**

```python
"""Central inference of device offline status (docs/edge-system/SRS.md §5.1).

A device never reports itself offline -- it only ever claims 'online' or
'maintenance'. Silence is what means offline, and only the induk can observe
silence. This sweep is that observation.

A device that has gone quiet flips to 'offline' even if its last self-report was
'maintenance': "no news" must never be displayed as "known, attended maintenance".
"""

from __future__ import annotations

import os
import threading

from app.core.config import HEARTBEAT_INTERVAL_SEC, OFFLINE_THRESHOLD_SEC
from app.repositories import edge_repo
from app.utils.timeutil import utc_iso_seconds_ago

_started = threading.Event()


def sweep_once() -> int:
    """Flip every silent device to 'offline'. Returns how many changed.

    Devices with last_heartbeat_at IS NULL (provisioned but never deployed) are
    left alone -- there is nothing to infer from silence that was never preceded
    by contact.
    """
    threshold = utc_iso_seconds_ago(OFFLINE_THRESHOLD_SEC)
    changed = edge_repo.sweep_offline(threshold)
    if changed:
        print(
            f"device_status: {changed} device(s) -> offline "
            f"(no heartbeat since {threshold})"
        )
    return changed


def _loop() -> None:
    # Same cadence as the heartbeat interval, so staleness is detected within one
    # extra cycle at most (SRS §5.1).
    while True:
        if _started.wait(timeout=HEARTBEAT_INTERVAL_SEC):
            return  # shutdown requested
        try:
            sweep_once()
        except Exception as err:  # pragma: no cover - the sweep must never die
            print(f"device_status: sweep failed: {err}")


def start_background_sweep() -> threading.Thread | None:
    """Start the sweep loop as a daemon thread.

    Returns None when disabled via DISABLE_EDGE_SWEEP=true -- useful for CLI
    invocations and any environment that should not mutate device status.
    """
    if os.environ.get("DISABLE_EDGE_SWEEP", "").lower() in ("1", "true", "yes"):
        print("device_status: background sweep disabled via DISABLE_EDGE_SWEEP")
        return None
    thread = threading.Thread(target=_loop, name="edge-offline-sweep", daemon=True)
    thread.start()
    return thread


def stop_background_sweep() -> None:
    """Signal the loop to exit at its next tick (used by the app lifespan)."""
    _started.set()
```

> `_started` is an inverted-sense `Event` — it is *set* to request shutdown, and
> `Event.wait(timeout=...)` doubles as an interruptible sleep. That is deliberate: a plain
> `time.sleep(30)` would leave the process hanging up to 30s on shutdown.

---

## 5.2 [DONE] Wire it into app startup

**File:** `app/main.py`

Use a `lifespan` context manager, **not** a bare call inside `create_app()`. `app = create_app()`
runs at import time, including in every test module — a bare call would start a thread that mutates
device status underneath your tests. `TestClient(app)` constructed without a `with` block does not
trigger lifespan, so tests stay unaffected while uvicorn still gets the sweep.

```python
"""FastAPI application factory and dev runner for the Smart Gate backend."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import DATA_DIR, ensure_directories
from app.routers import api_router
from app.services import device_status


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run background jobs for the lifetime of a served application.

    Deliberately not called from create_app(): ``app = create_app()`` executes at
    import time in every test module, and a sweep thread mutating device status
    underneath the suite would make tests flaky. TestClient only triggers this
    when used as a context manager, which the tests do not do.
    """
    device_status.start_background_sweep()
    yield
    device_status.stop_background_sweep()


def create_app() -> FastAPI:
    ensure_directories()
    app = FastAPI(title="Smart Gate Hauling API Backend", lifespan=lifespan)
    app.mount("/media", StaticFiles(directory=str(DATA_DIR)), name="media")
    app.include_router(api_router)

    @app.exception_handler(StarletteHTTPException)
    async def _dict_detail_exception_handler(request: Request, exc: StarletteHTTPException):
        """Return dict-shaped HTTPException details verbatim (API_CONTRACT §0)."""
        if isinstance(exc.detail, dict):
            return JSONResponse(exc.detail, status_code=exc.status_code)
        return await http_exception_handler(request, exc)

    @app.get("/")
    def health_check() -> dict:
        return {
            "status": "online",
            "service": "Smart Gate Hauling API Backend",
            "frontend": "http://localhost:3000",
        }

    return app


app = create_app()


def run(host: str = "127.0.0.1", port: int = 8000) -> None:
    import uvicorn

    print(f"\nSmart Gate Hauling Dashboard running at:  http://{host}:{port}\n")
    uvicorn.run(app, host=host, port=port, log_level="warning")
```

This is the complete file after both Section 02's handler and this section's lifespan.

---

## 5.3 [DONE] Tests

**New file:** `tests/test_device_status_sweep.py`

```python
"""Offline sweep (TC-010-07).

Calls sweep_once() directly -- never sleeps. A test that waits 90s for a
background thread is a test nobody runs.
"""

from __future__ import annotations

from app.repositories import edge_repo
from app.services import cameras as cam
from app.services import device_status
from app.utils.timeutil import utc_iso_seconds_ago, utc_now_iso
from tests.conftest import EDGE_TEST_CODE


def _set_heartbeat(camera_code: str, iso: str | None, status: str = "online") -> None:
    """Force a device's last-seen time directly, bypassing the API."""
    from app.core.database import connect

    conn = connect()
    try:
        conn.execute(
            "UPDATE cameras SET last_heartbeat_at = ?, status = ? WHERE camera_code = ?",
            (iso, status, camera_code),
        )
        conn.commit()
    finally:
        conn.close()


def test_silent_device_flips_offline(client, edge_camera):
    _set_heartbeat(EDGE_TEST_CODE, utc_iso_seconds_ago(91), "online")
    assert device_status.sweep_once() >= 1
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "offline"


def test_recent_device_is_untouched(client, edge_camera):
    _set_heartbeat(EDGE_TEST_CODE, utc_iso_seconds_ago(10), "online")
    device_status.sweep_once()
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "online"


def test_device_at_threshold_boundary_is_untouched(client, edge_camera):
    # 89s < the 90s threshold -- must survive.
    _set_heartbeat(EDGE_TEST_CODE, utc_iso_seconds_ago(89), "online")
    device_status.sweep_once()
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "online"


def test_never_heartbeated_device_is_untouched(client, edge_camera):
    # last_heartbeat_at IS NULL -- provisioned but never deployed. Nothing to
    # infer from silence that was never preceded by contact (SRS §5.1).
    _set_heartbeat(EDGE_TEST_CODE, None, "maintenance")
    device_status.sweep_once()
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "maintenance"


def test_stale_maintenance_is_overridden(client, edge_camera):
    # "No news" must never render as "known, attended maintenance" (SRS §5.1).
    _set_heartbeat(EDGE_TEST_CODE, utc_iso_seconds_ago(120), "maintenance")
    device_status.sweep_once()
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "offline"


def test_heartbeat_brings_a_swept_device_back(client, edge_camera, auth_headers):
    _set_heartbeat(EDGE_TEST_CODE, utc_iso_seconds_ago(120), "online")
    device_status.sweep_once()
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "offline"

    client.post("/api/edge/heartbeat", headers=auth_headers, json={
        "agent_version": "1.0.0", "applied_config_version": 1,
        "local_queue_depth": 0, "status": "online",
    })
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == "online"


def test_sweep_is_idempotent(client, edge_camera):
    _set_heartbeat(EDGE_TEST_CODE, utc_iso_seconds_ago(120), "online")
    assert device_status.sweep_once() >= 1
    # Already offline -> the WHERE status != 'offline' guard means no rework.
    before = cam.get_camera(EDGE_TEST_CODE)["status"]
    device_status.sweep_once()
    assert cam.get_camera(EDGE_TEST_CODE)["status"] == before == "offline"
```

> These tests assert `>= 1` rather than `== 1` for the sweep's return value: the real database may
> hold other seeded cameras (`CAM-GATE-A`..`D`) that are also stale. Asserting an exact count would
> make the test depend on unrelated DB state.

---

## Acceptance for Section 05

- [ ] `uv run pytest tests/test_device_status_sweep.py -q` passes.
- [ ] Starting the server (`uv run python main.py web`) logs nothing alarming and does not spin the
      CPU; `DISABLE_EDGE_SWEEP=true uv run python main.py web` prints the disabled notice.
- [ ] `uv run pytest tests/ -q` shows no new failures.
