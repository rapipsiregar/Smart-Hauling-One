"""SQLite access for per-crossing wall-clock time on ``video_results``.

Two nullable columns back the crossing timestamp:

``source_started_at``
    Wall-clock time of frame 0 of the stream segment (realtime RTSP) or of the
    clip (batch recording). Written by the detection pipeline.
``crossed_at``
    The resolved moment the truck passed the gate.

Both stay NULL until a real source supplies them. Nothing here derives a time
from processing time, ingest order, or file copy dates — an unknown crossing
time is reported as unknown rather than invented.
"""

from __future__ import annotations

import sqlite3

from app.core.database import connect

TIME_COLUMNS = {
    "source_started_at": "TEXT",
    "crossed_at": "TEXT",
}


def ensure_schema(conn: sqlite3.Connection | None = None) -> None:
    """Add the crossing-time columns to ``video_results`` (idempotent)."""
    own = conn is None
    conn = conn or connect()
    try:
        existing = {r[1] for r in conn.execute("PRAGMA table_info(video_results)")}
        for column, sql_type in TIME_COLUMNS.items():
            if column not in existing:
                conn.execute(f"ALTER TABLE video_results ADD COLUMN {column} {sql_type}")
        conn.commit()
    finally:
        if own:
            conn.close()


def load_crossing_times() -> dict[str, dict]:
    """``{video: {"crossedAt": str|None, "sourceStartedAt": str|None}}``."""
    ensure_schema()
    out: dict[str, dict] = {}
    try:
        conn = connect()
        rows = conn.execute(
            "SELECT video, crossed_at, source_started_at FROM video_results"
        ).fetchall()
        conn.close()
    except Exception as err:  # pragma: no cover - defensive
        print(f"crossing_time_repo: read failed: {err}")
        return out

    for video, crossed_at, source_started_at in rows:
        out[video] = {"crossedAt": crossed_at, "sourceStartedAt": source_started_at}
    return out


def first_detection_offsets() -> dict[str, float]:
    """``{video: seconds}`` — offset of the earliest detected frame per video.

    Combined with ``source_started_at`` this pins the moment the truck entered
    the camera's view.
    """
    ensure_schema()
    out: dict[str, float] = {}
    try:
        conn = connect()
        rows = conn.execute(
            """
            SELECT vr.video, MIN(d.timestamp_seconds)
            FROM video_results vr
            JOIN detections d ON d.video_result_id = vr.id
            WHERE d.timestamp_seconds IS NOT NULL
            GROUP BY vr.video
            """
        ).fetchall()
        conn.close()
    except Exception as err:  # pragma: no cover - defensive
        print(f"crossing_time_repo: offset read failed: {err}")
        return out

    for video, offset in rows:
        if offset is not None:
            out[video] = float(offset)
    return out


def set_crossing_time(
    video: str, crossed_at: str | None, source_started_at: str | None = None
) -> None:
    """Persist a resolved crossing time. Used by the pipeline and by backfill."""
    ensure_schema()
    conn = connect()
    try:
        if source_started_at is None:
            conn.execute(
                "UPDATE video_results SET crossed_at = ? WHERE video = ?",
                (crossed_at, video),
            )
        else:
            conn.execute(
                "UPDATE video_results SET crossed_at = ?, source_started_at = ? "
                "WHERE video = ?",
                (crossed_at, source_started_at, video),
            )
        conn.commit()
    finally:
        conn.close()
