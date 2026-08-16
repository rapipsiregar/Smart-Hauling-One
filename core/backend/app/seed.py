"""Seed 4 gate cameras and attribute the real playlist clips to them.

The camera system attributes each processed clip to a camera by the playlist
**subfolder** the clip lives in. To stand up a realistic 4-gate demo we:

1. create four gate subfolders under ``data/01-playlist/``,
2. deterministically distribute the existing real clips across them (even,
   reproducible split by sorted filename — never random),
3. register four cameras, each pointing at one folder,
4. run the real ``sync_attribution`` so ``video_results.camera_id`` is written
   from the folders (survives future re-syncs).

Attribution therefore stays genuinely folder-derived. Run with::

    uv run python -m app.seed          # seed / re-seed (idempotent)
    uv run python -m app.seed --undo   # move clips back to root, drop cameras

Idempotent: re-running redistributes the clips and upserts the cameras.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from app.core.config import ALLOWED_VIDEO_EXTS, PLAYLIST_DIR
from app.services import cameras as cam
from app.services.dataset import invalidate_cache

# No "direction" here anymore -- every gate accepts and detects both inbound
# and outbound traffic, decided per truck by its virtual center line
# (edge/backend/agent/pipeline.py), not by which gate it crossed.
GATES = [
    {"camera_code": "CAM-GATE-A", "name": "CP 01", "gate_location": "Area Selatan",
     "folder": "gate-a", "status": "online",
     "rtsp_url": "rtsp://10.20.0.11:554/gate-a"},
    {"camera_code": "CAM-GATE-B", "name": "CP 02", "gate_location": "Area Utara",
     "folder": "gate-b", "status": "online",
     "rtsp_url": "rtsp://10.20.0.12:554/gate-b"},
    {"camera_code": "CAM-GATE-C", "name": "CP 03", "gate_location": "Area Utara",
     "folder": "gate-c", "status": "online",
     "rtsp_url": "rtsp://10.20.0.13:554/gate-c"},
    {"camera_code": "CAM-GATE-D", "name": "CP 04", "gate_location": "Area Selatan",
     "folder": "gate-d", "status": "maintenance",
     "rtsp_url": "rtsp://10.20.0.14:554/gate-d"},
]


def _all_clips() -> list[Path]:
    """Every playlist clip (recursive), sorted by filename for a stable split."""
    if not PLAYLIST_DIR.is_dir():
        return []
    clips = [
        f for f in PLAYLIST_DIR.rglob("*")
        if f.is_file() and f.suffix.lower() in ALLOWED_VIDEO_EXTS
    ]
    return sorted(clips, key=lambda p: p.name)


def _move(clip: Path, dest_dir: Path) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / clip.name
    if clip.resolve() == dest.resolve():
        return
    if dest.exists():
        dest.unlink()
    shutil.move(str(clip), str(dest))


def seed() -> dict:
    clips = _all_clips()
    if not clips:
        raise SystemExit(f"No clips found under {PLAYLIST_DIR}")

    n = len(clips)
    moved = {g["folder"]: 0 for g in GATES}
    for idx, clip in enumerate(clips):
        gate = GATES[min(idx * len(GATES) // n, len(GATES) - 1)]
        _move(clip, PLAYLIST_DIR / gate["folder"])
        moved[gate["folder"]] += 1

    for gate in GATES:
        if cam.get_camera(gate["camera_code"]) is None:
            cam.create_camera(gate)
        else:
            cam.update_camera(gate["camera_code"], gate)

    tagged = cam.sync_attribution()
    invalidate_cache()
    return {"clips": n, "per_folder": moved, "tagged": tagged}


def undo() -> dict:
    """Move every clip back to the playlist root and delete the gate cameras."""
    for clip in _all_clips():
        _move(clip, PLAYLIST_DIR)
    for gate in GATES:
        cam.delete_camera(gate["camera_code"])
        folder = PLAYLIST_DIR / gate["folder"]
        if folder.is_dir() and not any(folder.iterdir()):
            folder.rmdir()
    cam.sync_attribution()
    invalidate_cache()
    return {"restored": True}


def main() -> None:
    if "--undo" in sys.argv[1:]:
        print("Undo:", undo())
        return
    result = seed()
    print(f"Seeded {result['clips']} clips across {len(GATES)} gates: {result['per_folder']}")
    print(f"Cameras registered and {result['tagged']} video rows attributed.")


if __name__ == "__main__":
    main()
