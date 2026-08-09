"""Extract the single clearest plate image per video from existing detection records.

For each video, selects the detection whose normalized text matches the voted hull
ID with the highest quality (detection_conf * ocr_conf), seeks that frame, draws the
annotated bounding box on the full frame, and saves it as an image.
"""

from __future__ import annotations

from pathlib import Path

import cv2

from .ocr_utils import normalize_hull_id, pad_crop
from .visualizer import draw_annotations

OUTPUT_DIR = Path("data/12-plate-snapshots")


def _best_detection(detections: list[dict], voted_id: str) -> dict | None:
    """Pick the detection best representing the voted ID, ranked by combined confidence."""
    matches = [
        d for d in detections
        if d.get("raw_text") and normalize_hull_id(d["raw_text"]) == voted_id
    ]
    pool = matches if matches else [d for d in detections if d.get("raw_text")]
    if not pool:
        return None

    def score(d: dict) -> float:
        return float(d.get("detection_confidence", 0.0)) * float(d.get("ocr_confidence", 0.0) or 0.0)

    return max(pool, key=score)


def save_plate_snapshot(
    video_path: Path,
    detections: list[dict],
    voted_id: str,
    vote_conf: float = 0.0,
    out_dir: Path = OUTPUT_DIR,
    out_name: str | None = None,
) -> Path | None:
    """Grab the clearest plate crop for one video and write it to disk."""
    if not detections or voted_id in ("UNKNOWN", "ERROR", ""):
        return None

    best = _best_detection(detections, voted_id)
    if best is None:
        return None

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None
    try:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(best["frame_index"]))
        ret, frame = cap.read()
        if not ret or frame is None:
            return None

        ts = best.get("timestamp_seconds")
        annotated = draw_annotations(frame, [best], voted_id, vote_conf, timestamp=ts)

        out_dir.mkdir(parents=True, exist_ok=True)
        safe_id = "".join(c if c.isalnum() or c in "-_" else "_" for c in voted_id)
        stem = video_path.stem
        out_path = out_dir / (out_name or f"{stem}__{safe_id}.jpg")
        cv2.imwrite(str(out_path), annotated)
        return out_path
    finally:
        cap.release()

def _top_detections(detections: list[dict], voted_id: str, limit: int) -> list[dict]:
    """Rank detections representing the voted ID, one per frame, best first."""
    matches = [
        d for d in detections
        if d.get("raw_text") and normalize_hull_id(d["raw_text"]) == voted_id
    ]
    pool = matches if matches else [d for d in detections if d.get("bbox")]

    def score(d: dict) -> float:
        return float(d.get("detection_confidence", 0.0)) * float(
            d.get("ocr_confidence", 0.0) or 0.0
        )

    pool = sorted(pool, key=score, reverse=True)
    seen_frames: set[int] = set()
    picked: list[dict] = []
    for d in pool:
        fi = int(d.get("frame_index", -1))
        if fi in seen_frames:
            continue
        seen_frames.add(fi)
        picked.append(d)
        if len(picked) >= limit:
            break
    return picked

def save_plate_crops(
    video_path: Path,
    detections: list[dict],
    voted_id: str,
    out_dir: Path = OUTPUT_DIR,
    job_id: str = "job",
    stem: str | None = None,
    max_crops: int = 8,
    pad: float = 0.08,
) -> list[Path]:
    """Save the tight bounding-box crop images of the clearest detections.

    Lightweight replacement for the annotated video: instead of rendering a
    heavy clip, we persist a handful of cropped plate images (the actual YOLO
    bounding boxes) so the operator can eyeball the raw evidence.
    """
    if not detections or voted_id in ("UNKNOWN", "ERROR", ""):
        return []

    picks = _top_detections(detections, voted_id, max_crops)
    if not picks:
        return []

    stem = stem or video_path.stem
    safe_id = "".join(c if c.isalnum() or c in "-_" else "_" for c in voted_id)
    out_dir.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return []
    saved: list[Path] = []
    try:
        for rank, det in enumerate(picks):
            bbox = det.get("bbox")
            if not bbox or len(bbox) != 4:
                continue
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(det["frame_index"]))
            ret, frame = cap.read()
            if not ret or frame is None:
                continue
            x0, y0, x1, y1 = (int(v) for v in bbox)
            crop = pad_crop(frame, x0, y0, x1, y1, pad=pad)
            if crop is None or crop.size == 0:
                continue
            out_path = out_dir / f"{job_id}__{stem}__{safe_id}__crop{rank:02d}.jpg"
            cv2.imwrite(str(out_path), crop)
            saved.append(out_path)
    finally:
        cap.release()
    return saved
