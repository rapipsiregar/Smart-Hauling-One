"""Ephemeral live-view session orchestration (``docs/edge-system/SRS.md`` §8).

Sessions are in-memory only. SRS §9: "a session exists only in memory for its
duration... there is nothing to migrate or back up here." A process restart drops
every session, which is correct -- the viewers are gone too.

Control is edge-initiated by necessity: the 4 devices sit behind cellular NAT and
cannot be reached inbound, so "start streaming" is delivered as the response to a
long-poll the edge is already holding open (SRS §8.2), not as a push.

Threading, not asyncio: this codebase has no ``pytest-asyncio`` and its routes are
sync. With 4 devices at most 4 long-polls are ever parked, which is trivial
against FastAPI's default threadpool.
"""

from __future__ import annotations

import os
import threading
import time
import uuid
from dataclasses import dataclass, field

from app.core.config import LIVE_SESSION_STALE_SEC

# Where the media relay lives. Both the browser and the edge resolve this, so a
# container-internal hostname will not do in production.
RELAY_BASE_URL = os.environ.get(
    "MEDIA_RELAY_BASE_URL", "http://localhost:8889"
).rstrip("/")

# Must stay well under LIVE_SESSION_STALE_SEC so teardown lands near the target.
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
    """Get-or-create this camera's long-poll wakeup signal. Caller holds ``_lock``."""
    event = _signals.get(camera_code)
    if event is None:
        event = threading.Event()
        _signals[camera_code] = event
    return event


def _queue_action(camera_code: str, action: dict) -> None:
    """Hand an action to this camera's long-poll and wake it. Caller holds ``_lock``."""
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
    """Viewer keep-alive. ``False`` when the session is unknown or already ended.

    The first keep-alive promotes ``requested`` -> ``active``. SRS §8.3 defines
    "active" as the WHIP push confirmed connected by the media relay, which the
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
    (API_CONTRACT §2.4). Pass ``session_id=None`` to force-stop whatever is
    running (used by the stale sweep).
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

    Returns ``{"action": "none"}`` on timeout; the agent immediately reopens the
    poll. Runs in FastAPI's threadpool -- at most 4 of these are ever parked.
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
    _shutdown.clear()
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
