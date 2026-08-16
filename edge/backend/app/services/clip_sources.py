"""Test clips available on this device.

A gate keeps a folder of recorded clips so a technician can prove the detection
chain works without waiting for a truck. In production the same chain runs on
the live RTSP stream; these files exercise it on demand.

Two folders, deliberately kept apart:

``CLIP_DIR``
    This gate's own operational footage -- real trucks from this site, named with
    the direction they were filmed in. Direction-filtered, because replaying an
    outbound clip at an inbound gate files the crossing as an arrival.

``SAMPLE_DIR``
    Reference footage (``docs/sample-references/``), for showing the detector
    working on trucks that are not this fleet. Read-only, offered at every gate
    regardless of direction, and never merged into ``CLIP_DIR``: mixing them
    would put unrelated video into the folder a gate treats as its own record,
    and there is no undo for that.

A name collision between the two resolves to the gate's own clip. The gate's
footage is the real thing; sample material must never shadow it.
"""

from __future__ import annotations

import os
from pathlib import Path

from app import store

CLIP_DIR = Path(os.environ.get("SMART_GATE_CLIP_DIR", "./video-sources"))
# Unset by default: a device in the field has no reason to carry reference
# footage, and an absent folder simply yields no sample clips.
SAMPLE_DIR = Path(os.environ.get("SMART_GATE_SAMPLE_CLIP_DIR", "")) \
    if os.environ.get("SMART_GATE_SAMPLE_CLIP_DIR") else None
EXTENSIONS = (".mp4", ".mkv", ".avi", ".mov")

GATE_SOURCE, SAMPLE_SOURCE = "gate", "contoh"


# When the core last answered, whoever asked. Recorded here because the config
# fetch is the one call every path makes -- boot, test run, agent -- so it is the
# honest evidence of reachability even when the agent threads are not running.
LAST_CONTACT_META = "core_last_contact"


def remember_core_contact() -> None:
    """Note that the core answered just now."""
    from datetime import datetime, timezone

    store.set_meta(LAST_CONTACT_META, datetime.now(timezone.utc).isoformat(timespec="seconds"))


def core_last_contact() -> str | None:
    return store.get_meta(LAST_CONTACT_META)


_INBOUND_MARKERS = (" - IN - ", " IN ", "_IN_", "INBOUND", " MASUK ")
_OUTBOUND_MARKERS = (" - OUT - ", " OUT ", "_OUT_", "OUTBOUND", " KELUAR ")


def clip_direction(filename: str) -> str | None:
    """Which way a clip's name claims it was filmed, if it says so at all.

    Informational only -- a gate no longer has a fixed direction to filter
    against (agent/pipeline.py's virtual center line decides that per truck
    from the video itself), so this is just a label the console can show next
    to a clip, e.g. "sudah diberi label: masuk".
    """
    name = filename.upper()
    if any(marker in name for marker in _INBOUND_MARKERS):
        return "inbound"
    if any(marker in name for marker in _OUTBOUND_MARKERS):
        return "outbound"
    return None


def _video_files(directory: Path | None) -> list[Path]:
    if directory is None or not directory.exists():
        return []
    return sorted(
        p for p in directory.iterdir()
        if p.is_file() and p.suffix.lower() in EXTENSIONS
    )


def list_clips(direction: str | None = None) -> list[dict]:
    """Playable clips for this device: the gate's own, then the reference set.

    Every clip is offered regardless of direction -- a gate no longer has a
    fixed direction to filter against, since the virtual center line decides
    inbound vs. outbound per truck from the video itself (agent/pipeline.py).
    ``direction`` is accepted and ignored rather than removed from the
    signature: existing callers (the /video-sources?direction= query param)
    keep working, they just no longer narrow anything.
    """
    clips = []

    for path in _video_files(CLIP_DIR):
        own = clip_direction(path.name)
        clips.append({
            "name": path.name,
            "size_bytes": path.stat().st_size,
            # So the console can say which clips are direction-matched and which
            # are simply unlabelled, rather than presenting them as equivalent.
            "direction": own,
            "source": GATE_SOURCE,
        })

    taken = {c["name"] for c in clips}
    for path in _video_files(SAMPLE_DIR):
        # A gate clip of the same name wins: this device's own footage is the
        # real record, and reference material must never shadow it.
        if path.name in taken:
            continue
        clips.append({
            "name": path.name,
            "size_bytes": path.stat().st_size,
            "direction": None,
            "source": SAMPLE_SOURCE,
        })
    return clips


def clip_path(name: str) -> Path | None:
    """Resolve one clip name to a real file inside one of the two folders.

    The name arrives from a request and is used as a filename, so each candidate
    is resolved and re-checked against its own directory: ``../../etc/passwd``
    must not read it. The gate's own folder is searched first, so a sample file
    can never stand in for a gate clip of the same name.
    """
    for directory in (CLIP_DIR, SAMPLE_DIR):
        if directory is None or not directory.exists():
            continue
        base = directory.resolve()
        candidate = (directory / name).resolve()
        if candidate.is_file() and candidate.parent == base:
            return candidate
    return None


def resolve(names: list[str] | None) -> list[Path]:
    """Turn requested clip names into paths, rejecting anything outside the folders."""
    # With no names given ("run everything"), default to the clips this gate
    # would actually see -- which is the gate's own footage only. Sweeping the
    # reference set into a bare "run everything" would file other people's trucks
    # as crossings at this gate; a sample has to be asked for by name.
    default = [c["name"] for c in list_clips() if c["source"] == GATE_SOURCE]
    paths = []
    for name in (names or default):
        path = clip_path(name)
        if path is not None:
            paths.append(path)
    return paths
