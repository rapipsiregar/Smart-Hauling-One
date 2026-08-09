"""Clean SQLite store for OCR hauling-truck inference results.

Rebuilds a lean schema (no legacy web-dashboard tables) and ingests the
consolidated JSON results plus per-detection records.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

DB_PATH = Path("data/smart_gate.db")

SCHEMA = """
CREATE TABLE runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_timestamp TEXT,
    model TEXT,
    input_directory TEXT,
    videos_processed INTEGER,
    total_elapsed_seconds REAL,
    ingested_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE video_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER REFERENCES runs(id) ON DELETE CASCADE,
    video TEXT,
    voted_hull_id TEXT,
    vote_confidence REAL,
    total_detections INTEGER,
    frames_with_detections INTEGER,
    snapshot_path TEXT
);

CREATE TABLE detections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_result_id INTEGER REFERENCES video_results(id) ON DELETE CASCADE,
    frame_index INTEGER,
    timestamp_seconds REAL,
    bbox TEXT,
    detection_confidence REAL,
    raw_text TEXT,
    ocr_confidence REAL
);

CREATE INDEX idx_vr_run ON video_results(run_id);
CREATE INDEX idx_det_vr ON detections(video_result_id);
CREATE INDEX idx_vr_hull ON video_results(voted_hull_id);
"""


def rebuild_schema(con: sqlite3.Connection) -> None:
    """Drop every existing table and recreate the clean inference schema."""
    cur = con.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    for (name,) in cur.fetchall():
        if name.startswith("sqlite_"):
            continue
        cur.execute(f'DROP TABLE IF EXISTS "{name}"')
    con.executescript(SCHEMA)
    con.commit()


def ingest_results(con: sqlite3.Connection, data: dict, snapshot_dir: Path | None = None) -> int:
    """Insert one run and all its video results + detections. Returns run id."""
    cur = con.cursor()
    cur.execute(
        "INSERT INTO runs (run_timestamp, model, input_directory, "
        "videos_processed, total_elapsed_seconds) VALUES (?, ?, ?, ?, ?)",
        (
            data.get("run_timestamp"),
            data.get("model"),
            data.get("input_directory"),
            data.get("videos_processed"),
            data.get("total_elapsed_seconds"),
        ),
    )
    run_id = cur.lastrowid

    for r in data.get("results", []):
        snapshot = _find_snapshot(snapshot_dir, r) if snapshot_dir else None
        cur.execute(
            "INSERT INTO video_results (run_id, video, voted_hull_id, vote_confidence, "
            "total_detections, frames_with_detections, snapshot_path) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                run_id,
                r.get("video"),
                r.get("voted_hull_id"),
                r.get("vote_confidence", 0.0),
                r.get("total_detections", 0),
                r.get("frames_with_detections", 0),
                snapshot,
            ),
        )
        vr_id = cur.lastrowid
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
            for d in r.get("detections", [])
        ]
        cur.executemany(
            "INSERT INTO detections (video_result_id, frame_index, timestamp_seconds, "
            "bbox, detection_confidence, raw_text, ocr_confidence) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            rows,
        )
    con.commit()
    return run_id


def _find_snapshot(snapshot_dir: Path, result: dict) -> str | None:
    """Match a plate snapshot file to a video result by stem prefix."""
    if not snapshot_dir or not snapshot_dir.is_dir():
        return None
    stem = Path(result.get("video", "")).stem
    for f in snapshot_dir.glob(f"{stem}__*.jpg"):
        return str(f.as_posix())
    return None
