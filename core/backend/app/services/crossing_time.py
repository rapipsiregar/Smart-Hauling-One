"""Resolve the wall-clock moment a truck crossed a gate.

Resolution order, each step backed by a real source:

1. **Realtime RTSP** — the pipeline records ``source_started_at`` when it opens
   a stream segment; the crossing time is that plus the in-segment offset of the
   first detected frame. This is the intended production path.
2. **Recorded clips** — a filename that encodes capture time
   (``<CAM>_<YYYYMMDD>_<HHMMSS>``) is parsed.
3. **Unknown** — ``None``.

Deliberately absent: file mtime and processing/ingest time. Both are properties
of when a file was written or handled, not of when a truck passed a gate, so
using them would put invented numbers into ritase reports.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta
from pathlib import Path

from app.repositories import crossing_time_repo

# <anything>_YYYYMMDD_HHMMSS<anything>, e.g. CAM-GATE-A_20260719_141530.mp4
FILENAME_TIME = re.compile(r"(?P<date>\d{8})[_\-T](?P<time>\d{6})")

ISO = "%Y-%m-%dT%H:%M:%S"


def parse_recording_filename(video: str) -> datetime | None:
    """Capture time encoded in a recording filename, or ``None``."""
    match = FILENAME_TIME.search(Path(video).stem)
    if not match:
        return None
    try:
        return datetime.strptime(
            f"{match.group('date')}{match.group('time')}", "%Y%m%d%H%M%S"
        )
    except ValueError:
        return None


def _from_segment(source_started_at: str | None, offset_seconds: float | None):
    if not source_started_at:
        return None
    try:
        start = datetime.fromisoformat(str(source_started_at).replace(" ", "T"))
    except ValueError:
        return None
    return start + timedelta(seconds=float(offset_seconds or 0.0))


def resolve_crossed_at(
    video: str,
    stored: dict | None = None,
    offset_seconds: float | None = None,
) -> str | None:
    """Best real crossing time for ``video``, or ``None`` when unknown."""
    stored = stored or {}

    if stored.get("crossedAt"):
        return str(stored["crossedAt"])

    from_segment = _from_segment(stored.get("sourceStartedAt"), offset_seconds)
    if from_segment is not None:
        return from_segment.strftime(ISO)

    from_name = parse_recording_filename(video)
    if from_name is not None:
        return from_name.strftime(ISO)

    return None


def crossing_times_by_video() -> dict[str, str | None]:
    """``{video: crossed_at|None}`` for every processed video."""
    stored = crossing_time_repo.load_crossing_times()
    offsets = crossing_time_repo.first_detection_offsets()
    videos = set(stored) | set(offsets)
    return {
        video: resolve_crossed_at(video, stored.get(video), offsets.get(video))
        for video in videos
    }


def backfill_from_filenames() -> int:
    """Persist crossing times for recordings whose filename encodes one.

    Returns how many rows were filled. Safe to re-run; leaves rows without a
    parseable filename untouched.
    """
    filled = 0
    for video, stored in crossing_time_repo.load_crossing_times().items():
        if stored.get("crossedAt"):
            continue
        parsed = parse_recording_filename(video)
        if parsed is not None:
            crossing_time_repo.set_crossing_time(video, parsed.strftime(ISO))
            filled += 1
    return filled
