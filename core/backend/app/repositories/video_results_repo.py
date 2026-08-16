"""Read access to processing results: ``video_results``, ``detections``, ``runs``.

Reads prefer the real SQLite database and fall back to the pipeline's JSON
export when the DB is absent, so the dashboard works in either deployment.
"""

from __future__ import annotations

import json
import time

from app.core.config import DEFAULT_MODEL, DB_PATH, RESULTS_JSON
from app.core.database import connect


def _window_clause(since: str | None, until: str | None) -> tuple[str, list]:
    """``(WHERE ..., params)`` for a half-open crossing-time window.

    Compared as TEXT, which is correct because every writer stores the same
    zero-padded ``YYYY-MM-DDTHH:MM:SS`` form (see
    ``app/services/edge_ingest.py::normalize_crossed_at``) and that sorts
    lexicographically in the same order it sorts chronologically. It also lets
    the index on ``crossed_at`` do the work instead of a per-row conversion.
    """
    clauses: list[str] = []
    params: list = []
    if since is not None:
        clauses.append("crossed_at >= ?")
        params.append(since)
    if until is not None:
        clauses.append("crossed_at < ?")
        params.append(until)
    if not clauses:
        return "", params
    # NOT NULL is implied by the comparisons above, but stating it makes the
    # exclusion of undated rows a decision in the SQL rather than a side effect.
    return f"WHERE crossed_at IS NOT NULL AND {' AND '.join(clauses)}", params


def load_video_results(
    since: str | None = None,
    until: str | None = None,
) -> list[dict]:
    """Processed videos, optionally narrowed to ``[since, until)`` by crossing time.

    The window is applied in SQL, not after the fact. Loading the whole table
    and filtering in Python cost 10.3s at one day of target volume (30k rows)
    against 0.57s for the same data scoped — and the unscoped cost grows with
    total history, so it gets worse every day the site runs. With four gates
    writing 30,000 crossings a day that is the difference between a dashboard
    and a timeout.

    ``crossed_at`` and ``source_started_at`` are selected here rather than
    fetched by a second full-table pass in ``crossing_time_repo``: they live on
    this same row, and reading them twice was two scans for one fact.

    A row with no ``crossed_at`` is EXCLUDED by any window, matching
    ``app/services/mining_day.py``: it cannot be shown to belong to the period,
    and quietly including it would put haulage of unknown date into a report
    that gets signed. With no window it is returned as always.
    """
    if DB_PATH.exists():
        try:
            conn = connect()
            cursor = conn.cursor()
            where, params = _window_clause(since, until)
            cursor.execute(
                f"""
                SELECT video, voted_hull_id, vote_confidence, total_detections,
                       frames_with_detections, snapshot_path, camera_id, direction,
                       source, crossed_at, source_started_at
                FROM video_results
                {where}
                ORDER BY id ASC
                """,
                params,
            )
            rows = cursor.fetchall()
            conn.close()
            if rows:
                return [
                    {
                        "video": row[0],
                        "voted_hull_id": row[1],
                        "vote_confidence": row[2],
                        "total_detections": row[3],
                        "frames_with_detections": row[4],
                        "snapshot_path": row[5],
                        # Authoritative when set. Edge crossings have no playlist
                        # file, so folder guessing cannot attribute them.
                        "camera_id": row[6],
                        # Set by an edge device from its own virtual center line
                        # (agent/pipeline.py); NULL for batch rows and undirected
                        # windows.
                        "direction": row[7],
                        # 'edge' | 'batch' -- which pipeline produced this row.
                        # app/services/dataset.py needs this to know whether a
                        # missing direction means "ask the camera" (batch) or
                        # "this truck genuinely never crossed the line" (edge).
                        "source": row[8],
                        # When the truck actually crossed, straight off the row.
                        "crossed_at": row[9],
                        # Start of the stream segment, for rows whose crossing
                        # time has to be derived from an in-segment offset.
                        "source_started_at": row[10],
                    }
                    for row in rows
                ]
        except Exception as err:
            print(f"Error reading DB: {err}")

    if RESULTS_JSON.exists():
        try:
            return json.loads(RESULTS_JSON.read_text(encoding="utf-8")).get("results", [])
        except Exception:
            return []
    return []


def run_meta() -> dict:
    """Most recent processing run's timestamp and model (real ``runs`` row)."""
    meta = {"timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"), "model": DEFAULT_MODEL}
    if not DB_PATH.exists():
        return meta
    try:
        conn = connect()
        row = conn.execute(
            "SELECT run_timestamp, model FROM runs ORDER BY id DESC LIMIT 1"
        ).fetchone()
        conn.close()
        if row:
            meta["timestamp"] = str(row[0]).replace(" ", "T")
            meta["model"] = row[1] or DEFAULT_MODEL
    except Exception as err:  # pragma: no cover - defensive
        print(f"video_results_repo: run meta read failed: {err}")
    return meta


def detections_by_video() -> dict[str, dict]:
    """Per-video OCR frame reads, keyed by video filename.

    Each entry holds ``{"reads": [raw_text, ...], "det_confs": [float, ...]}``.
    """
    out: dict[str, dict] = {}
    if not DB_PATH.exists():
        return out
    try:
        conn = connect()
        rows = conn.execute(
            """
            SELECT vr.video, d.raw_text, d.detection_confidence
            FROM video_results vr
            JOIN detections d ON d.video_result_id = vr.id
            ORDER BY vr.id ASC, d.frame_index ASC
            """
        ).fetchall()
        conn.close()
    except Exception as err:  # pragma: no cover - defensive
        print(f"video_results_repo: detections read failed: {err}")
        return out

    for video, raw_text, det_conf in rows:
        entry = out.setdefault(video, {"reads": [], "det_confs": []})
        if raw_text:
            entry["reads"].append(raw_text)
        if det_conf is not None:
            entry["det_confs"].append(float(det_conf))
    return out
