"""Batched per-video inference: read frames in batches, run YOLO once, OCR crops."""

from __future__ import annotations

import gc
import sys

import cv2
from tqdm import tqdm

from .ocr_utils import (
    fuzzy_vote_distribution,
    normalize_hull_id,
    pad_crop,
    run_ocr_on_crop,
)


def free_gpu_memory() -> None:
    """Release cached GPU memory so one video does not slow the next."""
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
    except Exception:
        pass


def _read_batch(cap, n: int):
    """Read up to n frames; return list of (frame_idx, frame)."""
    batch = []
    for _ in range(n):
        ret, frame = cap.read()
        if not ret or frame is None:
            break
        batch.append(frame)
    return batch


def _bbox_iou(a, b) -> float:
    """Intersection-over-union of two [x0,y0,x1,y1] boxes."""
    ix0, iy0 = max(a[0], b[0]), max(a[1], b[1])
    ix1, iy1 = min(a[2], b[2]), min(a[3], b[3])
    iw, ih = max(0, ix1 - ix0), max(0, iy1 - iy0)
    inter = iw * ih
    if inter == 0:
        return 0.0
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def process_video(
    model,
    video_path,
    conf_threshold: float,
    max_frames: int | None,
    ocr_pipeline,
    skip_ocr: bool,
    batch_size: int = 8,
    frame_stride: int = 1,
    ocr_min_conf: float = 0.30,
    ocr_min_area: int = 400,
    dedup_iou: float = 0.92,
    progress_cb=None,
) -> dict:
    """Process a single video with batched YOLO detection + gated, fuzzy-voted OCR.

    frame_stride:  process every Nth frame only (#2 sampling).
    ocr_min_conf:  skip OCR when detection confidence below this (#3 gating).
    ocr_min_area:  skip OCR when bbox area (px^2) below this (#3 gating).
    dedup_iou:     skip OCR when bbox nearly matches the previous OCR'd box (#3 dedup).
    progress_cb:   optional callable(progress: dict) invoked once per processed
                   batch so callers can stream live per-frame OCR distribution.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"Error opening video file: {video_path}", file=sys.stderr)
        return {
            "video": video_path.name, "voted_hull_id": "ERROR",
            "total_detections": 0, "frames_with_detections": 0, "detections": [],
        }

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if frame_count <= 0:
        frame_count = 10_000
    if max_frames is not None:
        frame_count = min(frame_count, max_frames)

    detections: list[dict] = []
    candidates: list[tuple[str, float]] = []
    frame_idx = 0
    stride = max(1, frame_stride)
    last_ocr_box = None  # for dedup (#3)

    pbar = tqdm(total=frame_count, desc=video_path.name[:24], unit="f",
                leave=False, position=1)
    try:
        while frame_idx < frame_count:
            take = min(batch_size, frame_count - frame_idx)
            batch = _read_batch(cap, take)
            if not batch:
                break

            # Only keep frames on the stride grid; others decoded but skipped (#2).
            keep = [(frame_idx + o, f) for o, f in enumerate(batch)
                    if (frame_idx + o) % stride == 0]
            if keep:
                frames = [f for _, f in keep]
                try:
                    batch_results = model.predict(source=frames, conf=conf_threshold, verbose=False)
                except Exception as e:
                    free_gpu_memory()
                    if "out of memory" in str(e).lower() or "cuda" in str(e).lower():
                        # Retry frame by frame to prevent batch OOM crash
                        batch_results = []
                        for f in frames:
                            try:
                                batch_results.extend(model.predict(source=[f], conf=conf_threshold, verbose=False))
                            except Exception:
                                pass
                    else:
                        batch_results = []

                for (idx, frame), results in zip(keep, batch_results):
                    if results.boxes is None or len(results.boxes) == 0:
                        continue
                    for box in results.boxes:
                        x0, y0, x1, y1 = map(int, box.xyxy[0].tolist())
                        det_conf = float(box.conf.item())
                        bbox = [x0, y0, x1, y1]
                        detection = {
                            "frame_index": idx,
                            "timestamp_seconds": round(idx / fps, 3),
                            "bbox": bbox,
                            "detection_confidence": round(det_conf, 4),
                            "raw_text": "",
                            "ocr_confidence": 0.0,
                        }

                        # OCR gating (#3): confidence, area, and dedup checks.
                        area = (x1 - x0) * (y1 - y0)
                        do_ocr = (
                            not skip_ocr
                            and det_conf >= ocr_min_conf
                            and area >= ocr_min_area
                            and not (last_ocr_box is not None
                                     and _bbox_iou(bbox, last_ocr_box) >= dedup_iou)
                        )
                        if do_ocr:
                            crop = pad_crop(frame, x0, y0, x1, y1)  # #10 padding
                            if crop.size > 0:
                                text, ocr_conf = run_ocr_on_crop(crop, ocr_pipeline)  # #4
                                detection["raw_text"] = text
                                detection["ocr_confidence"] = round(ocr_conf, 4)
                                last_ocr_box = bbox
                                if text:
                                    norm = normalize_hull_id(text)  # #9
                                    if norm != "UNKNOWN":
                                        weight = det_conf * (ocr_conf or 0.5)
                                        candidates.append((norm, weight))
                        detections.append(detection)

            frame_idx += len(batch)
            free_gpu_memory()
            pbar.update(len(batch))
            pbar.set_postfix_str(f"det={len(detections)} ocr={len(candidates)}")

            # Live progress: emit a running snapshot of the consensus vote so the
            # UI can render the OCR distribution building up frame by frame.
            if progress_cb is not None:
                try:
                    live_id, live_conf, live_dist = fuzzy_vote_distribution(candidates)
                    progress_cb({
                        "frames_scanned": min(frame_idx, frame_count),
                        "frames_total": frame_count,
                        "reads": len(detections),
                        "ocr_reads": len(candidates),
                        "voted_hull_id": live_id,
                        "vote_confidence": live_conf,
                        "distribution": live_dist,
                    })
                except Exception:
                    pass
    finally:
        pbar.close()
        cap.release()
        free_gpu_memory()

    voted_hull_id, vote_score, vote_distribution = fuzzy_vote_distribution(candidates)  # #7/#8

    return {
        "video": video_path.name,
        "voted_hull_id": voted_hull_id,
        "vote_confidence": vote_score,
        "vote_distribution": vote_distribution,
        "ocr_reads": len(candidates),
        "total_detections": len(detections),
        "frames_with_detections": len({d["frame_index"] for d in detections}),
        "detections": detections,
    }
