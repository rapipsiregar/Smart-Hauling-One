"""Read access to processing results: ``video_results``, ``detections``, ``runs``.

Reads prefer the real SQLite database and fall back to the pipeline's JSON
export when the DB is absent, so the dashboard works in either deployment.
"""

from __future__ import annotations

import json
import time

from app.core.config import DEFAULT_MODEL, DB_PATH, RESULTS_JSON
from app.core.database import connect


def load_video_results() -> list[dict]:
    """Return one row per processed video (DB first, JSON export as fallback)."""
    if DB_PATH.exists():
        try:
            conn = connect()
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT video, voted_hull_id, vote_confidence, total_detections,
                       frames_with_detections, snapshot_path, camera_id, direction,
                       source
                FROM video_results
                ORDER BY id ASC
                """
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
