#!/usr/bin/env python3
"""Extract the clearest detected plate image per video from existing JSON results.

Skips all inference. Reads data/12-run-custom-model-results.json and saves one
best plate crop per video into data/12-plate-snapshots/.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from tqdm import tqdm

sys.path.append(str(Path(__file__).resolve().parent))
from custom_model.plate_snapshot import save_plate_snapshot

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_JSON = ROOT / "data" / "12-run-custom-model-results.json"
VIDEO_DIR = ROOT / "data" / "01-playlist"
ALT_VIDEO_DIR = ROOT / "data" / "01b-videos-converted-to-mp4"


def resolve_video(name: str) -> Path | None:
    for base in (VIDEO_DIR, ALT_VIDEO_DIR):
        candidate = base / name
        if candidate.exists():
            return candidate
    return None


def main() -> int:
    if not DEFAULT_JSON.exists():
        print(f"Error: Results JSON not found at {DEFAULT_JSON}", file=sys.stderr)
        return 1

    print(f"Loading results from {DEFAULT_JSON}...")
    try:
        data = json.loads(DEFAULT_JSON.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Error reading JSON: {e}", file=sys.stderr)
        return 1

    results = data.get("results", [])
    if not results:
        print("No video results found in JSON.", file=sys.stderr)
        return 0

    print(f"Found records for {len(results)} videos.")
    saved, skipped = 0, 0

    for r in tqdm(results, desc="Extracting plates", unit="video"):
        video_name = r["video"]
        voted_id = r["voted_hull_id"]
        vote_conf = r.get("vote_confidence", 0.0)
        detections = r.get("detections", [])

        video_path = resolve_video(video_name)
        if video_path is None:
            tqdm.write(f"Warning: source video {video_name} not found. Skipping.")
            skipped += 1
            continue

        out_file = save_plate_snapshot(
            video_path=video_path,
            detections=detections,
            voted_id=voted_id,
            vote_conf=vote_conf,
        )
        if out_file:
            tqdm.write(f"{video_name}: saved {out_file.name}")
            saved += 1
        else:
            tqdm.write(f"{video_name}: no clear plate for '{voted_id}' (skipped)")
            skipped += 1

    print(f"\nDone. Saved {saved} plate snapshots, skipped {skipped}.")
    print(f"Output folder: {ROOT / 'data' / '12-plate-snapshots'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
