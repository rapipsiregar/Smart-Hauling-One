"""The picture the HUD shows when nothing is being tested.

A gate screen that goes blank between trucks tells a technician nothing. This
keeps it showing the lane itself -- empty road, no truck passing -- so the panel
reads as a live camera at rest rather than as a broken one.

Two sources, in order:

1. The agent's frame ring. When the camera is connected this is genuinely live,
   the same frames the inference loop is reading, and no second RTSP connection
   is opened to get it (SRS §3.1: one capture, many consumers).
2. A still cached on disk. On a dev box with no camera there is nothing live to
   show, so a frame with no truck in it stands in.

Raw frames only. No boxes, no hull ids, no overlay of any kind -- the same rule
agent/live_view.py is built around (PRD Goal 7 / Non-Goal).
"""

from __future__ import annotations

import os
import threading
from pathlib import Path

_lock = threading.Lock()


def still_path() -> Path:
    """Where the resting frame is kept.

    Resolved per call, not at import: as a module constant the value was fixed by
    whichever module imported this first, so a test that pointed it at a temp dir
    could still write over the device's real frame.
    """
    return Path(os.environ.get("SMART_GATE_IDLE_STILL", "./data/idle-frame.jpg"))


def _encode(frame) -> bytes | None:
    import cv2

    ok, buffer = cv2.imencode(".jpg", frame)
    return buffer.tobytes() if ok else None


def live_frame(agent) -> bytes | None:
    """The newest frame off the agent's ring, or None when no camera is up."""
    ring = getattr(agent, "_ring", None) if agent else None
    if ring is None:
        return None
    _, frame = ring.latest()
    if frame is None:
        return None
    try:
        return _encode(frame)
    except Exception:
        return None


def cached_still() -> bytes | None:
    """The stored empty-lane frame, if one has been captured."""
    path = still_path()
    if not path.exists():
        return None
    try:
        return path.read_bytes()
    except OSError:
        return None


def store_still(jpeg: bytes) -> None:
    with _lock:
        path = still_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(jpeg)


def capture_still_from_clip(clip: Path, frame_index: int = 0) -> bytes | None:
    """Pull one frame out of a recorded clip, to serve as the resting view.

    Which frame is empty is a judgement about a specific camera's field of view,
    not something to infer: the detector only looks for hull numbers, so "no
    detection" happily includes a truck parked with its number turned away.
    So the frame is chosen by whoever installs the gate and passed in here.
    Frame 0 is the default because these clips open before the truck arrives.
    """
    import cv2

    capture = cv2.VideoCapture(str(clip))
    try:
        if frame_index:
            capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        ok, frame = capture.read()
    finally:
        capture.release()
    return _encode(frame) if ok else None
