#!/usr/bin/env python3
"""Clean the SQLite database and store all inference results into it.

Archives the previous DB (already done separately), rebuilds a lean schema,
and ingests data/12-run-custom-model-results.json with detection records and
matched plate-snapshot paths.
"""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))
from custom_model.database import DB_PATH, ingest_results, rebuild_schema

ROOT = Path(__file__).resolve().parent.parent
RESULTS_JSON = ROOT / "data" / "12-run-custom-model-results.json"
SNAPSHOT_DIR = ROOT / "data" / "12-plate-snapshots"


def main() -> int:
    if not RESULTS_JSON.exists():
        print(f"Error: results JSON not found at {RESULTS_JSON}", file=sys.stderr)
        return 1

    data = json.loads(RESULTS_JSON.read_text(encoding="utf-8"))
    print(f"Loaded {len(data.get('results', []))} video results.")

    db_file = ROOT / DB_PATH
    con = sqlite3.connect(db_file)
    try:
        print("Rebuilding clean schema (dropping legacy tables)...")
        rebuild_schema(con)

        print("Ingesting run + detections + snapshot links...")
        run_id = ingest_results(con, data, snapshot_dir=SNAPSHOT_DIR)

        cur = con.cursor()
        cur.execute("SELECT COUNT(*) FROM video_results")
        n_vids = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM detections")
        n_dets = cur.fetchone()[0]
        cur.execute(
            "SELECT video, voted_hull_id, vote_confidence, total_detections, snapshot_path "
            "FROM video_results ORDER BY id LIMIT 10"
        )
        print(f"\nRun #{run_id} stored: {n_vids} videos, {n_dets} detections.\n")
        print(f"{'VIDEO':<24} {'ID':<10} {'CONF':<6} {'DETS':<5} SNAPSHOT")
        print("-" * 78)
        for v, hid, conf, dets, snap in cur.fetchall():
            snap_name = Path(snap).name if snap else "-"
            print(f"{v[:23]:<24} {hid:<10} {conf:<6.3f} {dets:<5} {snap_name}")
    finally:
        con.commit()
        con.close()

    print(f"\nDatabase written: {db_file}")
    print("Legacy data archived at: data/smart_gate_db_archive.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
