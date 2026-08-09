"""Test clips available on this device.

A gate keeps a folder of recorded clips so a technician can prove the detection
chain works without waiting for a truck. In production the same chain runs on
the live RTSP stream; these files exercise it on demand.
"""

from __future__ import annotations

import os
from pathlib import Path

from app import store

CLIP_DIR = Path(os.environ.get("SMART_GATE_CLIP_DIR", "./video-sources"))
EXTENSIONS = (".mp4", ".mkv", ".avi", ".mov")


DIRECTION_META = "gate_direction"
# When the core last answered, whoever asked. Recorded here because the config
# fetch is the one call every path makes -- boot, test run, agent -- so it is the
# honest evidence of reachability even when the agent threads are not running.
LAST_CONTACT_META = "core_last_contact"


def remember_direction(direction: str | None) -> None:
    """Cache the direction the core reported for this gate.

    Written whenever the device fetches its config. Cached rather than asked for
    every time so the gate still knows which way it faces when the core is
    unreachable -- which is the state this whole device exists to survive.
    """
    if direction in ("inbound", "outbound"):
        store.set_meta(DIRECTION_META, direction)


def remember_core_contact() -> None:
    """Note that the core answered just now."""
    from datetime import datetime, timezone

    store.set_meta(LAST_CONTACT_META, datetime.now(timezone.utc).isoformat(timespec="seconds"))


def core_last_contact() -> str | None:
    return store.get_meta(LAST_CONTACT_META)


def get_gate_direction(override_dir: str | None = None) -> str | None:
    """Which way this gate faces: 'inbound', 'outbound', or None if unknown.

    Order: an explicit override, then what the core last told us, then the
    camera code as a last resort. The core is the owner -- a gate registered
    inbound at the centre but guessed outbound here would offer the technician
    exactly the wrong clips.
    """
    dir_str = (override_dir or os.environ.get("SMART_GATE_DIRECTION") or "").lower()
    if dir_str in ("in", "inbound"):
        return "inbound"
    if dir_str in ("out", "outbound"):
        return "outbound"

    remembered = store.get_meta(DIRECTION_META)
    if remembered in ("inbound", "outbound"):
        return remembered

    # Last resort. Codes like CAM-GATE-A carry no direction, so this usually
    # answers None -- and None means "show everything" rather than guess wrong.
    code = os.environ.get("SMART_GATE_CAMERA_CODE", "").upper()
    if any(k in code for k in ("-IN", "_IN", "INBOUND", "MASUK")):
        return "inbound"
    if any(k in code for k in ("-OUT", "_OUT", "OUTBOUND", "KELUAR")):
        return "outbound"
    return None


_INBOUND_MARKERS = (" - IN - ", " IN ", "_IN_", "INBOUND", " MASUK ")
_OUTBOUND_MARKERS = (" - OUT - ", " OUT ", "_OUT_", "OUTBOUND", " KELUAR ")


def clip_direction(filename: str) -> str | None:
    """Which way a clip was filmed, if its name says so. None when it does not.

    None is a real third answer, not a synonym for "wrong". Operational clips are
    named ``2152 - In - 20231027_081402.mp4`` and carry the claim; a folder of
    reference footage generally does not.
    """
    name = filename.upper()
    if any(marker in name for marker in _INBOUND_MARKERS):
        return "inbound"
    if any(marker in name for marker in _OUTBOUND_MARKERS):
        return "outbound"
    return None


def list_clips(direction: str | None = None) -> list[dict]:
    """Playable clips in the device's test folder, filtered by direction.

    A clip is hidden only when its name **claims the opposite direction** to this
    gate. Running an outbound clip on an inbound gate files the crossing as an
    arrival, which is worse than offering fewer choices -- that is what the
    filter is for.

    A clip whose name says nothing is offered. It makes no claim to contradict,
    and treating silence as a mismatch meant a folder of unmarked footage showed
    up as "Semua klip (0)" with nothing on screen to explain why -- the test
    feature simply appeared broken once a gate learned its direction.
    """
    if not CLIP_DIR.exists():
        return []

    target_dir = get_gate_direction(direction)
    clips = []
    for path in sorted(CLIP_DIR.iterdir()):
        if not (path.is_file() and path.suffix.lower() in EXTENSIONS):
            continue
        own = clip_direction(path.name)
        if target_dir is not None and own is not None and own != target_dir:
            continue
        clips.append({
            "name": path.name,
            "size_bytes": path.stat().st_size,
            # So the console can say which clips are direction-matched and which
            # are simply unlabelled, rather than presenting them as equivalent.
            "direction": own,
        })
    return clips


def resolve(names: list[str] | None) -> list[Path]:
    """Turn requested clip names into paths, rejecting anything outside CLIP_DIR.

    The name is used as a filename, so it is resolved and re-checked against the
    clip directory: a request for ``../../etc/passwd`` must not read it.
    """
    if not CLIP_DIR.exists():
        return []
    all_available = {
        path.name: (CLIP_DIR / path.name).resolve()
        for path in CLIP_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in EXTENSIONS
    }
    # With no names given ("run everything"), default to the clips this gate
    # would actually see. Running an outbound clip on an inbound gate files the
    # crossing as an arrival, which is worse than offering fewer choices.
    # An explicitly named clip is still honoured: the technician asked for it.
    default = [c["name"] for c in list_clips()]
    wanted = [n for n in (names or default) if n in all_available]
    paths = []
    for name in wanted:
        path = all_available[name]
        if path.is_file() and path.parent == CLIP_DIR.resolve():
            paths.append(path)
    return paths
