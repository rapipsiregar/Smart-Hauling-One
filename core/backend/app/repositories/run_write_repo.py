"""Write access for processing runs: ``runs``, ``video_results``, ``detections``.

The read side lives in ``video_results_repo``; this module is the only place
that inserts real inference output into the database. A re-run of a clip is an
**overwrite**: the previous ``video_results`` row for that filename (and its
detections) is deleted before the new one is written, so a video never appears
twice in the ledger.

Crossing-time columns are deliberately carried over rather than recomputed --
``source_started_at`` / ``crossed_at`` describe when a truck passed a gate, not
when the clip was processed, so re-processing must not invent or drop them.
"""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path

from app.core.config import DB_PATH, MODEL_PATH, PLAYLIST_DIR
from app.core.database import connect
from app.repositories.camera_repo import ensure_schema as ensure_camera_schema
from app.repositories.crossing_time_repo import ensure_schema as ensure_time_schema

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_timestamp TEXT,
    model TEXT,
    input_directory TEXT,
    videos_processed INTEGER,
    total_elapsed_seconds REAL,
    ingested_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS video_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER REFERENCES runs(id) ON DELETE CASCADE,
    video TEXT,
    voted_hull_id TEXT,
    vote_confidence REAL,
    total_detections INTEGER,
    frames_with_detections INTEGER,
    snapshot_path TEXT
);

CREATE TABLE IF NOT EXISTS detections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_result_id INTEGER REFERENCES video_results(id) ON DELETE CASCADE,
    frame_index INTEGER,
    timestamp_seconds REAL,
    bbox TEXT,
    detection_confidence REAL,
    raw_text TEXT,
    ocr_confidence REAL
);

CREATE INDEX IF NOT EXISTS idx_vr_run ON video_results(run_id);
CREATE INDEX IF NOT EXISTS idx_det_vr ON detections(video_result_id);
CREATE INDEX IF NOT EXISTS idx_vr_hull ON video_results(voted_hull_id);
"""

# Additive edge-ingestion columns (docs/edge-system/SRS.md §9). Edge crossings
# are a new producer into this same table, not a parallel data model.
VIDEO_RESULT_EDGE_COLUMNS = {
    "idempotency_key": "TEXT",                  # NULL for batch rows; UNIQUE index below
    "source": "TEXT NOT NULL DEFAULT 'batch'",  # 'batch' | 'edge'
    "votes_json": "TEXT",                       # JSON array of the consensus vote breakdown
    "window_sec": "REAL",                       # actual Detection Window duration; NULL for batch
    # 'inbound' | 'outbound' | NULL, decided per-crossing by the edge device's
    # virtual center line (agent/pipeline.py DetectionWindow.direction), not by
    # which gate submitted it. NULL for batch rows and for a window where the
    # truck never crossed the line.
    "direction": "TEXT",
}


def ensure_schema() -> None:
    """Create the inference tables and every added column (idempotent)."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = connect()
    try:
        conn.executescript(SCHEMA)
        existing = {r[1] for r in conn.execute("PRAGMA table_info(video_results)")}
        for column, ddl in VIDEO_RESULT_EDGE_COLUMNS.items():
            if column not in existing:
                conn.execute(f"ALTER TABLE video_results ADD COLUMN {column} {ddl}")
        # The real, concurrency-safe duplicate guard for edge submissions
        # (docs/data_model.md BR-010). SQLite treats NULLs as distinct in a
        # UNIQUE index, so every existing batch row (idempotency_key IS NULL)
        # coexists fine -- only non-NULL keys must be unique.
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_vr_idempotency "
            "ON video_results(idempotency_key)"
        )
        conn.commit()
    finally:
        conn.close()
    ensure_camera_schema()  # cameras table + video_results.camera_id
    ensure_time_schema()  # video_results.source_started_at / crossed_at


def start_run(model: str | None = None, input_directory: str | None = None) -> int:
    """Open a ``runs`` row for a batch and return its id."""
    ensure_schema()
    conn = connect()
    try:
        cur = conn.execute(
            "INSERT INTO runs (run_timestamp, model, input_directory, "
            "videos_processed, total_elapsed_seconds) VALUES (?, ?, ?, ?, ?)",
            (
                time.strftime("%Y-%m-%d %H:%M:%S"),
                model or MODEL_PATH.name,
                input_directory or str(PLAYLIST_DIR),
                0,
                0.0,
            ),
        )
        conn.commit()
        return int(cur.lastrowid)
    finally:
        conn.close()


def finish_run(run_id: int, videos_processed: int, elapsed_seconds: float) -> None:
    """Stamp the final video count and wall-clock cost onto a run."""
    conn = connect()
    try:
        conn.execute(
            "UPDATE runs SET videos_processed = ?, total_elapsed_seconds = ? WHERE id = ?",
            (videos_processed, round(float(elapsed_seconds), 2), run_id),
        )
        conn.commit()
    finally:
        conn.close()


def _carried_times(conn: sqlite3.Connection, video: str) -> tuple[str | None, str | None]:
    row = conn.execute(
        "SELECT source_started_at, crossed_at FROM video_results WHERE video = ? "
        "ORDER BY id DESC LIMIT 1",
        (video,),
    ).fetchone()
    return (row[0], row[1]) if row else (None, None)


def _delete_existing(conn: sqlite3.Connection, video: str) -> int:
    """Remove any prior result rows for ``video``. Returns rows removed."""
    ids = [r[0] for r in conn.execute("SELECT id FROM video_results WHERE video = ?", (video,))]
    for vr_id in ids:
        conn.execute("DELETE FROM detections WHERE video_result_id = ?", (vr_id,))
    conn.execute("DELETE FROM video_results WHERE video = ?", (video,))
    return len(ids)


def upsert_video_result(
    *,
    run_id: int,
    video: str,
    camera_id: int | None,
    voted_hull_id: str,
    vote_confidence: float,
    total_detections: int,
    frames_with_detections: int,
    snapshot_path: str | None,
    detections: list[dict] | None = None,
    source_started_at: str | None = None,
    crossed_at: str | None = None,
) -> dict:
    """Write one processed clip, replacing any earlier row for the same video.

    Returns ``{"video_result_id": int, "replaced": int}`` where ``replaced`` is
    how many prior rows were overwritten (0 for a first-time clip).
    """
    ensure_schema()
    video = Path(video).name
    conn = connect()
    try:
        prev_started, prev_crossed = _carried_times(conn, video)
        replaced = _delete_existing(conn, video)
        cur = conn.execute(
            "INSERT INTO video_results (run_id, video, voted_hull_id, vote_confidence, "
            "total_detections, frames_with_detections, snapshot_path, camera_id, "
            "source_started_at, crossed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                run_id,
                video,
                voted_hull_id,
                float(vote_confidence),
                int(total_detections),
                int(frames_with_detections),
                snapshot_path,
                camera_id,
                source_started_at if source_started_at is not None else prev_started,
                crossed_at if crossed_at is not None else prev_crossed,
            ),
        )
        vr_id = int(cur.lastrowid)
        rows = [
            (
                vr_id,
                d.get("frame_index"),
                d.get("timestamp_seconds"),
                json.dumps(d.get("bbox")),
                d.get("detection_confidence"),
                d.get("raw_text", ""),
                d.get("ocr_confidence", 0.0),
            )
            for d in (detections or [])
        ]
        if rows:
            conn.executemany(
                "INSERT INTO detections (video_result_id, frame_index, timestamp_seconds, "
                "bbox, detection_confidence, raw_text, ocr_confidence) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                rows,
            )
        conn.commit()
        return {"video_result_id": vr_id, "replaced": replaced}
    finally:
        conn.close()


def insert_edge_crossing(
    *,
    camera_id: int,
    video: str,
    hull_id: str,
    confidence: float,
    read_count: int,
    snapshot_path: str | None,
    idempotency_key: str,
    window_sec: float,
    votes_json: str,
    detected_at_iso: str,
    direction: str | None = None,
) -> tuple[int, bool]:
    """Insert one edge-submitted crossing.

    Returns ``(video_result_id, created)``. ``created`` is False when the
    idempotency key was already present -- the caller turns that into a
    ``200 {"duplicate": true}`` instead of a ``201`` (SRS §5.2).

    ``run_id`` stays NULL: an edge submission is a single live crossing, not a
    batch run over a directory of clips.
    """
    ensure_schema()
    conn = connect()
    try:
        cur = conn.execute(
            "INSERT INTO video_results (run_id, video, voted_hull_id, vote_confidence, "
            "total_detections, frames_with_detections, snapshot_path, camera_id, "
            "source_started_at, crossed_at, idempotency_key, source, votes_json, "
            "window_sec, direction) "
            "VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'edge', ?, ?, ?)",
            (
                video,
                hull_id,
                float(confidence),
                int(read_count),
                # No frame concept in a live window; read_count is the closest
                # existing analog and keeps the dashboard's "frames" column honest.
                int(read_count),
                snapshot_path,
                int(camera_id),
                detected_at_iso,
                detected_at_iso,
                idempotency_key,
                votes_json,
                float(window_sec),
                direction,
            ),
        )
        conn.commit()
        return int(cur.lastrowid), True
    except sqlite3.IntegrityError:
        # Two retries raced between the caller's SELECT and this INSERT. The
        # UNIQUE index -- not the application check -- is the actual guard.
        conn.rollback()
        row = conn.execute(
            "SELECT id FROM video_results WHERE idempotency_key = ?", (idempotency_key,)
        ).fetchone()
        if row is None:  # pragma: no cover - a non-idempotency integrity error
            raise
        return int(row[0]), False
    finally:
        conn.close()


def find_by_idempotency_key(idempotency_key: str) -> int | None:
    """Return an existing crossing's id for this key, or None (SRS §5.2 fast path)."""
    ensure_schema()
    conn = connect()
    try:
        row = conn.execute(
            "SELECT id FROM video_results WHERE idempotency_key = ?", (idempotency_key,)
        ).fetchone()
        return int(row[0]) if row else None
    finally:
        conn.close()


def processed_videos() -> dict[str, dict]:
    """``{video: {hullId, confidence, processedAt}}`` for every stored clip."""
    ensure_schema()
    conn = connect()
    try:
        rows = conn.execute(
            "SELECT vr.video, vr.voted_hull_id, vr.vote_confidence, r.run_timestamp "
            "FROM video_results vr LEFT JOIN runs r ON r.id = vr.run_id ORDER BY vr.id ASC"
        ).fetchall()
    finally:
        conn.close()
    return {
        row[0]: {
            "hullId": row[1],
            "confidence": float(row[2] or 0.0),
            "processedAt": row[3],
        }
        for row in rows
    }
