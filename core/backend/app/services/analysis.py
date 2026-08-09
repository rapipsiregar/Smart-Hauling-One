"""Video analysis: run one clip through detect -> OCR -> snapshot/crops.

``app.core.config`` is imported first so ``labs/`` is on ``sys.path`` before the
``custom_model`` pipeline modules are imported.
"""

from __future__ import annotations

from pathlib import Path

from app.core.config import ALLOWED_VIDEO_EXTS, MODEL_PATH, PLAYLIST_DIR, WEB_RESULTS_DIR
from app.utils.paths import relative_to_root

from custom_model.plate_snapshot import save_plate_crops, save_plate_snapshot
from custom_model.video_processor import process_video

SNAPSHOT_DIR = WEB_RESULTS_DIR / "snapshots"
CROP_DIR = WEB_RESULTS_DIR / "crops"

_MODEL = None
_OCR = None


def list_playlist_videos() -> list[str]:
    """Sorted names of analysable videos in the playlist tree (recursive).

    The camera system attributes clips by playlist subfolder, so videos may live
    in gate folders (``01-playlist/gate-a/...``); listing must recurse to see them.
    """
    if not PLAYLIST_DIR.is_dir():
        return []
    return sorted(
        f.name
        for f in PLAYLIST_DIR.rglob("*")
        if f.is_file() and f.suffix.lower() in ALLOWED_VIDEO_EXTS
    )


def resolve_playlist_video(name: str) -> Path | None:
    """Locate a playlist video by basename anywhere under the playlist tree."""
    if not PLAYLIST_DIR.is_dir():
        return None
    target = Path(name).name
    for f in PLAYLIST_DIR.rglob(target):
        if f.is_file() and f.suffix.lower() in ALLOWED_VIDEO_EXTS:
            return f
    return None


def _load_engines(device: str = "cuda"):
    global _MODEL, _OCR
    if _MODEL is None:
        from ultralytics import YOLO

        _MODEL = YOLO(str(MODEL_PATH))
    if _OCR is None:
        from paddleocr import PaddleOCRVL

        dev = "gpu" if device.startswith("cuda") else "cpu"
        _OCR = PaddleOCRVL(
            pipeline_version="v1.6",
            engine="transformers",
            use_layout_detection=False,
            device=dev,
        )
    return _MODEL, _OCR


def analyze_video(
    video_path: Path,
    device: str = "cuda",
    job_id: str = "job",
    progress_cb=None,
    detections_sink: list | None = None,
) -> dict:
    """Detect -> OCR one clip and return the dashboard-shaped result.

    ``detections_sink``, when supplied, is filled with the raw per-frame
    detection records so the caller can persist them. They stay out of the
    returned payload because the browser never needs thousands of frame rows.
    """
    model, ocr = _load_engines(device)

    result = process_video(
        model=model,
        video_path=video_path,
        conf_threshold=0.25,
        max_frames=None,
        ocr_pipeline=ocr,
        skip_ocr=False,
        frame_stride=5,
        progress_cb=progress_cb,
    )

    voted_id = result.get("voted_hull_id", "UNKNOWN")
    vote_conf = float(result.get("vote_confidence", 0.0) or 0.0)
    detections = result.get("detections", [])
    distribution = result.get("vote_distribution", [])
    ocr_reads = result.get("ocr_reads", 0)

    if detections_sink is not None:
        detections_sink.extend(detections)

    stem = video_path.stem
    safe_id = "".join(c if c.isalnum() or c in "-_" else "_" for c in voted_id)

    snapshot = save_plate_snapshot(
        video_path=video_path,
        detections=detections,
        voted_id=voted_id,
        vote_conf=vote_conf,
        out_dir=SNAPSHOT_DIR,
        out_name=f"{job_id}__{stem}__{safe_id}.jpg",
    )

    crops = save_plate_crops(
        video_path=video_path,
        detections=detections,
        voted_id=voted_id,
        out_dir=CROP_DIR,
        job_id=job_id,
        stem=stem,
    )

    return {
        "truck_id": voted_id,
        "found": voted_id not in ("UNKNOWN", "ERROR", ""),
        "certainty": round(vote_conf * 100),
        "reads": result.get("total_detections", 0),
        "ocr_reads": ocr_reads,
        "frames_scanned": result.get("frames_with_detections", 0),
        "distribution": distribution,
        "snapshot": relative_to_root(snapshot),
        "crops": [relative_to_root(c) for c in crops],
        "annotated_video": None,
    }
