"""CCTV detection view — real per-frame OCR reads shaped for the frontend."""

from __future__ import annotations

from collections import Counter

from app.repositories.video_results_repo import detections_by_video, run_meta
from app.services.dataset import build_dataset, filter_by_camera


def _tower_for_lane(lane: str) -> str:
    letter = lane.replace("Gate ", "").strip()[:1] or "X"
    return f"TWR-{letter}"


def _camera_label(direction: str | None) -> str:
    """Fallback label when the crossing has no named camera."""
    return f"Cam: {direction.title()}" if direction else "Cam: Unassigned"


def build_cctv_detections(
    camera_code: str | None = None, camera_id: int | None = None
) -> list[dict]:
    ds = build_dataset()
    meta = run_meta()
    det_map = detections_by_video()
    detections: list[dict] = []
    for c in ds["crossings"]:
        video = c["video"]
        info = det_map.get(video, {"reads": [], "det_confs": []})
        reads = info["reads"]
        det_confs = info["det_confs"]
        frame_results = reads[:12]
        voted = c["hull_id"]
        if reads:
            top, _ = Counter(reads).most_common(1)[0]
            consistent = top == voted
        else:
            consistent = False
        det_avg = round(sum(det_confs) / len(det_confs) * 100, 1) if det_confs else 0.0
        cam_code = c.get("camera_code")
        cam_name = c.get("camera_name")
        detections.append({
            "id": f"det-{c['id']}",
            "video": video,
            "towerId": cam_code or _tower_for_lane(c["lane"]),
            "location": c["lane"],
            "camera": cam_name or _camera_label(c.get("direction")),
            "cameraId": c.get("camera_id"),
            "cameraCode": cam_code,
            "cameraName": cam_name,
            "rtspUrl": c.get("rtsp_url"),
            "timestamp": meta["timestamp"],
            "ocrText": voted,
            "confidence": c["confidence"],
            "croppedText": voted,
            "framesProcessed": c["frames"],
            "frameResults": frame_results,
            "ocrReadCount": len(reads),
            "detectionConfidence": det_avg,
            "isConsistent": consistent,
            "aiModel": meta["model"],
            # The visual evidence, carried on the detection itself so the
            # inspection panel can show it inline. There is no separate crossing
            # detail page any more, and a reading without its picture is a claim
            # an operator has no way to check.
            "imageProofUrl": c["snapshot"],
            "contextImageUrl": c["annotated_video"],
        })
    return filter_by_camera(detections, camera_code, camera_id)
