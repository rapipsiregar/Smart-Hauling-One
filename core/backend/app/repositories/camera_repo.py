"""SQLite access for the ``cameras`` table and video attribution column.

Pure persistence: no validation or folder logic (that lives in the camera
service). Callers pass already-cleaned column dicts.
"""

from __future__ import annotations

import sqlite3

from app.core.database import connect

# Additive edge-device columns (docs/edge-system/SRS.md §9). Defaults match
# docs/edge-system/PRD.md §9. SQLite's ALTER TABLE ADD COLUMN accepts DEFAULT but
# not UNIQUE/REFERENCES -- none of these need either.
EDGE_CAMERA_COLUMNS = {
    "api_key_hash": "TEXT",                       # NULL until provisioned; never returned by a read endpoint
    "agent_version": "TEXT",                      # NULL until the first heartbeat
    "yolo_fps": "INTEGER NOT NULL DEFAULT 20",
    "ocr_fps": "INTEGER NOT NULL DEFAULT 4",
    "detect_window_sec": "INTEGER NOT NULL DEFAULT 6",
    "ocr_min_conf": "REAL NOT NULL DEFAULT 0.30",
    "dedup_iou": "REAL NOT NULL DEFAULT 0.92",
    # 'ltr' | 'rtl' -- which way an ARRIVING truck crosses this camera's frame.
    # Defaults to 'ltr' so existing rows keep the behaviour they were running.
    "inbound_axis": "TEXT NOT NULL DEFAULT 'ltr'",
    "config_version": "INTEGER NOT NULL DEFAULT 1",
    "applied_config_version": "INTEGER NOT NULL DEFAULT 0",
    "last_heartbeat_at": "TEXT",                  # ISO 8601 UTC with 'Z'
    "last_config_applied_at": "TEXT",             # ISO 8601 UTC with 'Z'
    "local_queue_depth": "INTEGER NOT NULL DEFAULT 0",
}


def ensure_schema(conn: sqlite3.Connection | None = None) -> None:
    """Create the ``cameras`` table, its edge columns, and ``video_results.camera_id``.

    Idempotent. The ``video_results`` migration is skipped when that table does
    not exist yet: on a fresh database this module can run before
    ``run_write_repo.ensure_schema`` has created it, and attempting the ALTER
    unconditionally would raise ``no such table``.
    """
    own = conn is None
    conn = conn or connect(rows=True)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS cameras (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                camera_code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                gate_location TEXT,
                direction TEXT DEFAULT 'both',
                status TEXT DEFAULT 'offline',
                rtsp_url TEXT,
                ip_host TEXT,
                username TEXT,
                resolution TEXT,
                fps INTEGER,
                folder TEXT UNIQUE,
                install_date TEXT,
                last_seen TEXT,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
            """
        )
        cam_cols = {r[1] for r in conn.execute("PRAGMA table_info(cameras)")}
        for column, ddl in EDGE_CAMERA_COLUMNS.items():
            if column not in cam_cols:
                conn.execute(f"ALTER TABLE cameras ADD COLUMN {column} {ddl}")

        tables = {
            r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        if "video_results" in tables:
            cols = {r[1] for r in conn.execute("PRAGMA table_info(video_results)")}
            if "camera_id" not in cols:
                conn.execute(
                    "ALTER TABLE video_results ADD COLUMN camera_id INTEGER "
                    "REFERENCES cameras(id) ON DELETE SET NULL"
                )
        conn.commit()
    finally:
        if own:
            conn.close()


def list_rows() -> list[dict]:
    ensure_schema()
    conn = connect(rows=True)
    try:
        rows = conn.execute("SELECT * FROM cameras ORDER BY camera_code ASC").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_row(camera_code: str) -> dict | None:
    ensure_schema()
    conn = connect(rows=True)
    try:
        row = conn.execute(
            "SELECT * FROM cameras WHERE camera_code = ?", (camera_code,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def insert_row(data: dict) -> bool:
    """Insert a camera. Returns False on a duplicate ``camera_code``/``folder``."""
    ensure_schema()
    cols = list(data.keys())
    placeholders = ", ".join("?" for _ in cols)
    conn = connect(rows=True)
    try:
        conn.execute(
            f"INSERT INTO cameras ({', '.join(cols)}) VALUES ({placeholders})",
            [data[c] for c in cols],
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def update_row(camera_code: str, data: dict) -> bool:
    """Update the given columns. Returns False on a folder uniqueness clash."""
    assignments = ", ".join(f"{c} = ?" for c in data)
    conn = connect(rows=True)
    try:
        conn.execute(
            f"UPDATE cameras SET {assignments} WHERE camera_code = ?",
            [*data.values(), camera_code],
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def delete_row(camera_code: str) -> None:
    conn = connect(rows=True)
    try:
        conn.execute("DELETE FROM cameras WHERE camera_code = ?", (camera_code,))
        conn.commit()
    finally:
        conn.close()


def iter_video_results() -> list[dict]:
    """All ``(id, video)`` rows, for re-attributing cameras."""
    conn = connect(rows=True)
    try:
        return [dict(r) for r in conn.execute("SELECT id, video FROM video_results")]
    finally:
        conn.close()


def bulk_set_camera_ids(pairs: list[tuple[int, int | None]]) -> None:
    """Persist ``(video_result_id, camera_id)`` assignments in one transaction."""
    conn = connect(rows=True)
    try:
        conn.executemany(
            "UPDATE video_results SET camera_id = ? WHERE id = ?",
            [(camera_id, vr_id) for vr_id, camera_id in pairs],
        )
        conn.commit()
    finally:
        conn.close()
