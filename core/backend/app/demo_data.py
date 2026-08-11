"""Seed a realistic demo dataset without needing any video files.

``app.seed`` stands up the 4 gates by distributing **real clips** across playlist
subfolders — it needs ``data/01-playlist/`` to be populated. That directory is
gitignored, so a fresh checkout has no footage and therefore no crossings: the
dashboard renders empty and every test that indexes into a crossing list fails
with ``IndexError``.

This module fills that gap. It writes ``video_results`` rows with ``camera_id``
set directly, which works because the read path prefers the stored FK over
playlist-folder guessing. No files on disk are required.

Every row it creates is identifiable: ``video`` names start with ``demo-`` and the
run is recorded under its own ``runs`` entry, so ``--undo`` removes exactly what
was added and nothing else.

    uv run python -m app.demo_data           # seed (idempotent)
    uv run python -m app.demo_data --undo    # remove every demo row

NOT a substitute for real footage. This exists so the app is demonstrable and the
suite is runnable on a checkout with no data; real accuracy work needs real clips
through the real pipeline.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta

from app.core.database import connect
from app.repositories import run_write_repo
from app.seed import GATES
from app.services import cameras as cam
from app.services.dataset import invalidate_cache

# Matches the model name the reference tests expect in the runs table.
DEMO_MODEL = "smart-hauling-ai-v2.pt"
DEMO_PREFIX = "demo-"

def _fleet_sample(n: int = 7) -> list[str]:
    """Real hull ids drawn from the master registry.

    Demo crossings must reference units that actually exist: the master is the
    source of truth for the fleet, so inventing hull ids here would produce
    crossings the fleet views could never reconcile.
    """
    from app.repositories import truck_master_repo

    hulls = [t["hull_id"] for t in truck_master_repo.list_all()]
    if not hulls:
        raise SystemExit(
            "master registry is empty -- run `python -m app.services.master_import` first"
        )
    return hulls[:n]


def _read_variants(hull_id: str) -> list[tuple[str, float]]:
    """Plausible per-frame OCR reads for one hull.

    A gate camera sees only the 4-digit code, so the reads are digits plus the
    optical confusions the matcher is built to absorb (``2`` misread as ``Z``,
    ``1`` as ``I``) -- which also exercises the vote-distribution views with the
    kind of disagreement real footage produces.
    """
    import re

    code = re.search(r"(\d{4})", hull_id)
    code = code.group(1) if code else "0000"
    noisy = code.replace("2", "Z", 1) if "2" in code else code.replace("1", "I", 1)
    return [(code, 0.94), (code, 0.91), (noisy, 0.68), (code, 0.88)]

# One full haul cycle per truck: IN at a loading gate, OUT at a dumping gate.
# Gate A/C are inbound, B/D outbound (see app.seed.GATES), which is what lets
# app/services/ritase.py pair them into completed ritase.
GATE_PAIRS = [("CAM-GATE-A", "CAM-GATE-B"), ("CAM-GATE-C", "CAM-GATE-D")]


def _cycles() -> list[tuple[str, str, str, int]]:
    """``(hull_id, in_gate, out_gate, offset_minutes)`` for each demo haul."""
    hulls = _fleet_sample()
    return [
        (hull, *GATE_PAIRS[idx % len(GATE_PAIRS)], idx * 13)
        for idx, hull in enumerate(hulls)
    ]


BASE_TIME = datetime(2026, 8, 2, 6, 0, 0)
CYCLE_MINUTES = 18  # loaded haul + return, typical for this pit


def _ensure_gates() -> dict[str, int]:
    """Register the 4 gate cameras. Returns ``{camera_code: id}``."""
    for gate in GATES:
        if cam.get_camera(gate["camera_code"]) is None:
            cam.create_camera(gate)
        else:
            cam.update_camera(gate["camera_code"], gate)
    return {g["camera_code"]: cam.get_camera(g["camera_code"])["id"] for g in GATES}


def _start_run(conn) -> int:
    """Open the demo run row the reference views read model/timestamp from."""
    cur = conn.execute(
        "INSERT INTO runs (run_timestamp, model, input_directory, videos_processed, "
        "total_elapsed_seconds) VALUES (?, ?, ?, ?, ?)",
        (
            BASE_TIME.strftime("%Y-%m-%d %H:%M:%S"),
            DEMO_MODEL,
            f"{DEMO_PREFIX}dataset",
            len(_cycles()) * 2,
            412.5,
        ),
    )
    return int(cur.lastrowid)


def _insert_crossing(conn, *, run_id, camera_id, hull, video, crossed_at, confidence):
    """One video_results row plus its per-frame detection reads."""
    reads = _read_variants(hull)
    cur = conn.execute(
        "INSERT INTO video_results (run_id, video, voted_hull_id, vote_confidence, "
        "total_detections, frames_with_detections, snapshot_path, camera_id, "
        "source_started_at, crossed_at, source) "
        "VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'batch')",
        (
            run_id, video, hull, confidence, len(reads), len(reads),
            camera_id, crossed_at, crossed_at,
        ),
    )
    vr_id = int(cur.lastrowid)
    conn.executemany(
        "INSERT INTO detections (video_result_id, frame_index, timestamp_seconds, "
        "bbox, detection_confidence, raw_text, ocr_confidence) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (
                vr_id,
                idx * 7,
                round(idx * 0.28, 2),
                json.dumps([320 + idx * 4, 210, 480 + idx * 4, 275]),
                round(0.86 + idx * 0.02, 3),
                raw_text,
                ocr_conf,
            )
            for idx, (raw_text, ocr_conf) in enumerate(reads)
        ],
    )
    return vr_id


def seed() -> dict:
    run_write_repo.ensure_schema()
    gate_ids = _ensure_gates()

    conn = connect()
    try:
        run_id = _start_run(conn)
        created = 0
        for hull, in_gate, out_gate, offset_min in _cycles():
            entered = BASE_TIME + timedelta(minutes=offset_min)
            exited = entered + timedelta(minutes=CYCLE_MINUTES)
            # A high-confidence IN and a slightly lower OUT -- the outbound camera
            # sees a dusty, loaded truck, which is genuinely harder to read.
            for gate_code, moment, conf in (
                (in_gate, entered, 0.96),
                (out_gate, exited, 0.91),
            ):
                video = f"{DEMO_PREFIX}{hull}-{gate_code}-{moment:%H%M}.mp4"
                _insert_crossing(
                    conn,
                    run_id=run_id,
                    camera_id=gate_ids[gate_code],
                    hull=hull,
                    video=video,
                    crossed_at=moment.strftime("%Y-%m-%dT%H:%M:%S"),
                    confidence=conf,
                )
                created += 1
        conn.commit()
    finally:
        conn.close()

    # No registry write: the master table (app/services/master_import.py) is the
    # source of truth for the fleet now, and it already contains these hulls.

    invalidate_cache()
    return {"crossings": created, "trucks": len(_fleet_sample()), "gates": len(gate_ids)}


def undo() -> dict:
    """Remove every demo row, leaving any real data untouched."""
    run_write_repo.ensure_schema()
    conn = connect()
    try:
        conn.execute(
            "DELETE FROM detections WHERE video_result_id IN "
            "(SELECT id FROM video_results WHERE video LIKE ?)",
            (f"{DEMO_PREFIX}%",),
        )
        cur = conn.execute("DELETE FROM video_results WHERE video LIKE ?", (f"{DEMO_PREFIX}%",))
        removed = cur.rowcount
        conn.execute("DELETE FROM runs WHERE input_directory = ?", (f"{DEMO_PREFIX}dataset",))
        conn.commit()
    finally:
        conn.close()
    invalidate_cache()
    return {"removed": removed}


def main() -> None:
    if "--undo" in sys.argv[1:]:
        print("Removed demo rows:", undo())
        return
    # Re-seeding should not stack duplicates.
    undo()
    result = seed()
    print(
        f"Seeded {result['crossings']} demo crossings for {result['trucks']} trucks "
        f"across {result['gates']} gates."
    )
    print("Remove with: uv run python -m app.demo_data --undo")


if __name__ == "__main__":
    main()
