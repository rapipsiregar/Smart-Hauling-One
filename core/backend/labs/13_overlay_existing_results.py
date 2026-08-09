#!/usr/bin/env python3
"""Overlay existing JSON inference results onto source videos.

Skips YOLO/OCR inference entirely. Reads bounding box and text records
from data/12-run-custom-model-results.json and draws them onto the MP4s.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from tqdm import tqdm

# Add labs to path for modular imports
sys.path.append(str(Path(__file__).resolve().parent))
from custom_model.visualizer import create_annotated_video

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_JSON = ROOT / "data" / "12-run-custom-model-results.json"
VIDEO_DIR = ROOT / "data" / "01-playlist"


def main() -> int:
    # 1. Load results JSON
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

    # 2. Process each video record
    for r in tqdm(results, desc="Annotating Videos", unit="video"):
        video_name = r["video"]
        voted_id = r["voted_hull_id"]
        vote_conf = r.get("vote_confidence", 0.0)
        detections = r.get("detections", [])

        # Find matching video file
        video_path = VIDEO_DIR / video_name
        if not video_path.exists():
            # Fallback check
            alt_path = ROOT / "data" / "01b-videos-converted-to-mp4" / video_name
            if alt_path.exists():
                video_path = alt_path
            else:
                tqdm.write(f"Warning: Source video file {video_name} not found in playlist directory. Skipping.")
                continue

        tqdm.write(f"Rendering: {video_name} (ID: {voted_id})...")
        try:
            # We use stride=1 here because the JSON already contains exact frame index mappings
            out_file = create_annotated_video(
                video_path=video_path,
                detections=detections,
                voted_id=voted_id,
                vote_conf=vote_conf,
                frame_stride=1,
            )
            if out_file:
                tqdm.write(f"Saved: {out_file.name}")
        except Exception as e:
            tqdm.write(f"Error rendering {video_name}: {e}")

    print("\nOverlay generation complete!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
