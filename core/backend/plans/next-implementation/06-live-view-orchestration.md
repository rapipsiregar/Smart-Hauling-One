# Section 06 — Live Raw CCTV View Orchestration

**Goal:** an operator opens one gate's raw feed on demand; the edge is told to start pushing within
about one round-trip; the session tears itself down if the viewer disappears.
**Depends on:** [03](./03-edge-ingestion-api.md). **Blocks:** 07, 08.

Implements `docs/edge-system/API_CONTRACT.md` §1.4 + §2.4, `SRS.md` §8, `sys_uc_009.md`.

**Scope:** session orchestration only. The induk never touches video frames — a separate media
relay does (Section 07 scaffolds it). Without a deployed relay, `whip_url`/`whep_url` are
well-formed but point at nothing. Everything in this section is still fully testable, because
none of it depends on media actually flowing.

> **Use `threading`, not `asyncio`.** See README §C. There is no `pytest-asyncio` dependency and
> the codebase is sync throughout. With 4 devices, at most 4 long-polls are ever parked — trivial
> against FastAPI's default 40-thread pool.

---

## 6.1 [DONE] Create `app/services/live_sessions.py`

**New file.**

```python
"""Ephemeral live-view session orchestration (docs/edge-system/SRS.md §8).

Sessions are in-memory only. SRS §9: "a session exists only in memory for its
duration... there is nothing to migrate or back up here." A process restart drops
every session, which is correct -- the viewers are gone too.

Control is edge-initiated by necessity: the 4 devices sit behind cellular NAT and
cannot be reached inbound, so "start streaming" is delivered as the response to a
long-poll the edge is already holding open (SRS §8.2), not as a push.
"""

from __future__ import annotations

import os
import threading
import time
import uuid
from dataclasses import dataclass, field

from app.core.config import LIVE_SESSION_STALE_SEC

# Where the media relay lives. Section 07 scaffolds it under docker-compose;
# override per environment. No trailing slash.
RELAY_BASE_URL = os.environ.get(
    "MEDIA_RELAY_BASE_URL", "http://localhost:8889"
).rstrip("/")

# How often the stale-session sweep ticks. Must be well under
# LIVE_SESSION_STALE_SEC so teardown lands close to the 20s target.
_SWEEP_INTERVAL_SEC = 5.0


@dataclass
class Session:
    session_id: str
    camera_code: str
    state: str = "requested"          # requested -> active -> ended
    last_keepalive: float = field(default_factory=time.monotonic)


# camera_code -> Session. Only one live session per gate at a time (SRS §8.3).
_sessions: dict[str, Session] = {}
# camera_code -> the next action its long-poll should receive.
_pending: dict[str, dict] = {}
# camera_code -> signal that _pending gained an entry.
_signals: dict[str, threading.Event] = {}
_lock = threading.RLock()
_shutdown = threading.Event()


def _signal_for(camera_code: str) -> threading.Event:
    """Get-or-create this camera's long-poll wakeup signal. Caller holds _lock."""
    event = _signals.get(camera_code)
    if event is None:
        event = threading.Event()
        _signals[camera_code] = event
    return event


def _queue_action(camera_code: str, action: dict) -> None:
    """Hand an action to this camera's long-poll and wake it. Caller holds _lock."""
    _pending[camera_code] = action
    _signal_for(camera_code).set()


def whep_url(camera_code: str, session_id: str) -> str:
    """Where the browser's WHEP player connects."""
    return f"{RELAY_BASE_URL}/whep/{camera_code}/{session_id}"


def whip_url(camera_code: str, session_id: str) -> str:
    """Where the edge pushes its raw feed."""
    return f"{RELAY_BASE_URL}/whip/{camera_code}/{session_id}"


# --- Dashboard-facing operations ---------------------------------------------

def start_session(camera_code: str) -> Session:
    """Request a live session, or return the one already running (SRS §8.3).

    Calling this twice for the same gate (two tabs, a refresh) is expected and
    harmless -- it returns the existing session rather than creating a competing
    second one. API_CONTRACT §4 explicitly reserves 409 as unused for this reason.
    """
    with _lock:
        existing = _sessions.get(camera_code)
        if existing is not None and existing.state != "ended":
            existing.last_keepalive = time.monotonic()
            return existing

        session = Session(session_id=str(uuid.uuid4()), camera_code=camera_code)
        _sessions[camera_code] = session
        _queue_action(camera_code, {
            "action": "start",
            "session_id": session.session_id,
            "whip_url": whip_url(camera_code, session.session_id),
            # Short-lived and single-use, scoped to this session only -- never the
            # device's long-lived API key (SRS §6 Security NFR).
            "whip_token": str(uuid.uuid4()),
        })
        return session


def heartbeat_session(camera_code: str, session_id: str) -> bool:
    """Viewer keep-alive. False when the session is unknown or already ended.

    The first keep-alive promotes 'requested' -> 'active'. SRS §8.3 defines
    'active' as "the WHIP push confirmed connected by the media relay", which the
    induk cannot observe without a relay integration; the frontend only starts
    heart-beating once its player has a session, which is the closest signal
    available. Nothing in the API contract exposes this state, so the distinction
    is internal only.
    """
    with _lock:
        session = _sessions.get(camera_code)
        if session is None or session.session_id != session_id or session.state == "ended":
            return False
        session.last_keepalive = time.monotonic()
        if session.state == "requested":
            session.state = "active"
        return True


def stop_session(camera_code: str, session_id: str | None = None) -> None:
    """End a session and tell the edge to stop pushing. Idempotent.

    Stopping an already-ended or unknown session is explicitly not an error
    (API_CONTRACT §2.4). Pass session_id=None to force-stop whatever is running
    (used by the stale sweep).
    """
    with _lock:
        session = _sessions.get(camera_code)
        if session is None:
            return
        if session_id is not None and session.session_id != session_id:
            return
        session.state = "ended"
        del _sessions[camera_code]
        _queue_action(camera_code, {"action": "stop", "session_id": session.session_id})


def get_session(camera_code: str) -> Session | None:
    with _lock:
        return _sessions.get(camera_code)


# --- Edge-facing long-poll ----------------------------------------------------

def wait_for_action(camera_code: str, wait_seconds: float) -> dict:
    """Block up to ``wait_seconds`` for an action for this gate (SRS §8.2).

    Returns {"action": "none"} on timeout; the agent immediately reopens the poll.
    Runs in FastAPI's threadpool -- at most 4 of these are ever parked at once.
    """
    with _lock:
        pending = _pending.pop(camera_code, None)
        if pending is not None:
            return pending
        event = _signal_for(camera_code)
        event.clear()

    event.wait(timeout=max(0.0, wait_seconds))

    with _lock:
        return _pending.pop(camera_code, None) or {"action": "none"}


# --- Stale-session sweep ------------------------------------------------------

def sweep_stale_sessions() -> int:
    """End sessions whose viewer stopped sending keep-alives (SRS §8.3 step 4).

    Covers the closed-tab case: without this, an abandoned viewer would leave an
    edge streaming indefinitely. Returns how many were ended.
    """
    now = time.monotonic()
    with _lock:
        stale = [
            code for code, s in _sessions.items()
            if now - s.last_keepalive > LIVE_SESSION_STALE_SEC
        ]
    for code in stale:
        print(f"live_sessions: {code} session timed out (no viewer keep-alive)")
        stop_session(code)
    return len(stale)


def _sweep_loop() -> None:
    while not _shutdown.wait(timeout=_SWEEP_INTERVAL_SEC):
        try:
            sweep_stale_sessions()
        except Exception as err:  # pragma: no cover - the sweep must never die
            print(f"live_sessions: sweep failed: {err}")


def start_stale_sweep() -> threading.Thread:
    thread = threading.Thread(target=_sweep_loop, name="live-session-sweep", daemon=True)
    thread.start()
    return thread


def stop_stale_sweep() -> None:
    _shutdown.set()


def reset_for_tests() -> None:
    """Drop all session state. Test-only."""
    with _lock:
        _sessions.clear()
        _pending.clear()
        _signals.clear()
```

---

## 6.2 [DONE] Create `app/routers/live.py`

**New file.**

```python
"""Dashboard-facing live-view control (docs/edge-system/API_CONTRACT.md §2.4).

Raw camera feed only -- never a detection overlay. This is the one dashboard
surface that deliberately shows no inference results at all (PRD Non-Goal).
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.edge import LiveSessionRef
from app.services import cameras, live_sessions

router = APIRouter(tags=["live"])


@router.post("/cameras/{camera_code}/live/start")
def live_start(camera_code: str):
    """Open (or rejoin) this gate's live session.

    Returns 200 even when the device is offline: the session enters 'requested'
    and simply never produces video until the device's long-poll picks it up
    (API_CONTRACT §2.4). The frontend treats "no video within a few seconds" as
    "device unreachable" -- it must not retry this endpoint, and this endpoint
    must not pre-emptively fail based on device_status.
    """
    if cameras.get_camera(camera_code) is None:
        return JSONResponse({"error": "Camera not found"}, status_code=404)
    session = live_sessions.start_session(camera_code)
    return {
        "session_id": session.session_id,
        "whep_url": live_sessions.whep_url(camera_code, session.session_id),
    }


@router.post("/cameras/{camera_code}/live/heartbeat")
def live_heartbeat(camera_code: str, body: LiveSessionRef):
    """Viewer keep-alive, sent roughly every 10s while the view is open."""
    if not live_sessions.heartbeat_session(camera_code, body.session_id):
        return JSONResponse({"error": "Session not found"}, status_code=404)
    return {"status": "success"}


@router.post("/cameras/{camera_code}/live/stop")
def live_stop(camera_code: str, body: LiveSessionRef):
    """End the session. Idempotent -- stopping an ended session is not an error."""
    live_sessions.stop_session(camera_code, body.session_id)
    return {"status": "success"}
```

Register it in `app/routers/__init__.py`:

```python
from app.routers import analysis, cameras, dashboard, edge, live, reference, testbench
...
api_router.include_router(live.router)
```

---

## 6.3 [DONE] Add the edge long-poll route

**File:** `app/routers/edge.py` — append.

```python
@router.get("/edge/live-session")
def get_live_session(
    wait: int = LIVE_SESSION_DEFAULT_WAIT_SEC,
    device: dict = Depends(authenticate_device),
):
    """Long-poll control channel for live view (API_CONTRACT §1.4).

    The agent holds this open and immediately reopens it on every response.
    ``wait`` is clamped rather than rejected, to tolerate a slightly
    misconfigured agent.
    """
    wait = max(0, min(int(wait), LIVE_SESSION_MAX_WAIT_SEC))
    return live_sessions.wait_for_action(device["camera_code"], wait)
```

Add to that file's imports:
```python
from app.core.config import LIVE_SESSION_DEFAULT_WAIT_SEC, LIVE_SESSION_MAX_WAIT_SEC
from app.services import live_sessions
```

---

## 6.4 [DONE] Start the stale sweep at app startup

**File:** `app/main.py` — extend the `lifespan` from Section 05:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    device_status.start_background_sweep()
    live_sessions.start_stale_sweep()
    yield
    device_status.stop_background_sweep()
    live_sessions.stop_stale_sweep()
```
Add `from app.services import device_status, live_sessions` to the imports.

---

## 6.5 [DONE] Tests

**New file:** `tests/test_live_sessions.py`

```python
"""Live-view session orchestration: TC-009-01 through TC-009-05.

Never sleeps for the real 20s timeout -- the stale sweep is driven by rewinding
last_keepalive and calling sweep_stale_sessions() directly.
"""

from __future__ import annotations

import threading
import time

import pytest

from app.core.config import LIVE_SESSION_STALE_SEC
from app.services import live_sessions
from tests.conftest import EDGE_TEST_CODE


@pytest.fixture(autouse=True)
def _reset_sessions():
    live_sessions.reset_for_tests()
    yield
    live_sessions.reset_for_tests()


def test_start_returns_session_and_whep_url(client, edge_camera):
    r = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"session_id", "whep_url"}
    assert body["session_id"] in body["whep_url"]
    assert EDGE_TEST_CODE in body["whep_url"]


def test_start_unknown_camera_404(client):
    r = client.post("/api/cameras/PYTEST-NO-SUCH-GATE/live/start")
    assert r.status_code == 404


def test_start_for_offline_device_still_succeeds(client, edge_camera):
    # TC-009-02: a session for an offline device is created and simply never
    # streams. The API must not pre-emptively fail.
    assert edge_camera["status"] == "offline"
    assert client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").status_code == 200


def test_duplicate_start_reuses_the_session(client, edge_camera):
    # TC-009-03: two tabs on the same gate is a harmless race, not a conflict.
    first = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").json()
    second = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").json()
    assert first["session_id"] == second["session_id"]
    assert first["whep_url"] == second["whep_url"]


def test_heartbeat_keeps_the_session_alive(client, edge_camera):
    session_id = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").json()["session_id"]
    r = client.post(
        f"/api/cameras/{EDGE_TEST_CODE}/live/heartbeat", json={"session_id": session_id}
    )
    assert r.status_code == 200
    assert r.json() == {"status": "success"}


def test_heartbeat_unknown_session_404(client, edge_camera):
    client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start")
    r = client.post(
        f"/api/cameras/{EDGE_TEST_CODE}/live/heartbeat",
        json={"session_id": "00000000-0000-4000-8000-000000000000"},
    )
    assert r.status_code == 404


def test_stop_is_idempotent(client, edge_camera):
    session_id = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").json()["session_id"]
    for _ in range(2):
        r = client.post(
            f"/api/cameras/{EDGE_TEST_CODE}/live/stop", json={"session_id": session_id}
        )
        assert r.status_code == 200
        assert r.json() == {"status": "success"}


def test_stop_after_heartbeat_ends_the_session(client, edge_camera):
    session_id = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").json()["session_id"]
    client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/stop", json={"session_id": session_id})
    r = client.post(
        f"/api/cameras/{EDGE_TEST_CODE}/live/heartbeat", json={"session_id": session_id}
    )
    assert r.status_code == 404


def test_stale_session_is_swept(client, edge_camera):
    # TC-009-05: tab closed without an explicit stop.
    client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start")
    session = live_sessions.get_session(EDGE_TEST_CODE)
    assert session is not None

    session.last_keepalive = time.monotonic() - (LIVE_SESSION_STALE_SEC + 1)
    assert live_sessions.sweep_stale_sessions() == 1
    assert live_sessions.get_session(EDGE_TEST_CODE) is None


def test_fresh_session_survives_the_sweep(client, edge_camera):
    client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start")
    assert live_sessions.sweep_stale_sessions() == 0
    assert live_sessions.get_session(EDGE_TEST_CODE) is not None


# --- Edge long-poll ----------------------------------------------------------

def test_longpoll_times_out_with_action_none(client, edge_camera, auth_headers):
    r = client.get("/api/edge/live-session?wait=0", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == {"action": "none"}


def test_longpoll_delivers_start_immediately(client, edge_camera, auth_headers):
    started = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").json()
    r = client.get("/api/edge/live-session?wait=0", headers=auth_headers)
    body = r.json()
    assert body["action"] == "start"
    assert body["session_id"] == started["session_id"]
    assert EDGE_TEST_CODE in body["whip_url"]
    assert body["whip_token"]
    # Single-use: the same action is not delivered twice.
    assert client.get(
        "/api/edge/live-session?wait=0", headers=auth_headers
    ).json() == {"action": "none"}


def test_longpoll_delivers_stop(client, edge_camera, auth_headers):
    started = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").json()
    client.get("/api/edge/live-session?wait=0", headers=auth_headers)  # consume start

    client.post(
        f"/api/cameras/{EDGE_TEST_CODE}/live/stop",
        json={"session_id": started["session_id"]},
    )
    body = client.get("/api/edge/live-session?wait=0", headers=auth_headers).json()
    assert body == {"action": "stop", "session_id": started["session_id"]}


def test_longpoll_wait_is_clamped_not_rejected(client, edge_camera, auth_headers):
    # API_CONTRACT §1.4: tolerate a misconfigured agent rather than erroring.
    r = client.get("/api/edge/live-session?wait=9999", headers=auth_headers)
    assert r.status_code == 200


def test_waiting_longpoll_is_woken_by_a_start(client, edge_camera, auth_headers):
    """A poll parked before the request must return as soon as one arrives."""
    result = {}

    def _poll():
        result["body"] = client.get(
            "/api/edge/live-session?wait=10", headers=auth_headers
        ).json()

    thread = threading.Thread(target=_poll)
    thread.start()
    time.sleep(0.3)  # let the poll park

    started = client.post(f"/api/cameras/{EDGE_TEST_CODE}/live/start").json()
    thread.join(timeout=5)

    assert not thread.is_alive(), "long-poll was not woken by the start request"
    assert result["body"]["action"] == "start"
    assert result["body"]["session_id"] == started["session_id"]
```

> The last test uses a real thread and a 0.3s sleep — the only place in this suite that sleeps. It
> is verifying the wakeup path itself, which cannot be checked any other way. Keep the sleep small
> and the join timeout generous.

---

## Acceptance for Section 06

- [ ] `uv run pytest tests/test_live_sessions.py -q` passes, including the wakeup test.
- [ ] `uv run pytest tests/ -q` shows no new failures.
- [ ] TC-009-06 (no detection overlay) is **not** backend-testable — it is a property of what the
      edge pushes over WHIP. Mark it N/A for backend tests; it belongs to Section 11.
