#!/usr/bin/env python3
"""Detect trucks/vehicles in playlist videos with YOLO26n; write annotated MP4s."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from tqdm import tqdm
from ultralytics import YOLO

from yolo26_video_io import open_frame_reader, open_frame_writer, probe_video

ROOT = Path(__file__).resolve().parent.parent
SLUG = "detect-truck-using-yolo26"
INPUT_DIR = ROOT / "data" / "01b-videos-converted-to-mp4"
OUTPUT_DIR = ROOT / "data" / f"08-{SLUG}"
VIDEO_EXTENSIONS = {".webm", ".mkv", ".mp4", ".avi", ".mov"}
MODEL_NAME = "yolo26n.pt"
VEHICLE_CLASSES = ("bicycle", "car", "motorcycle", "bus", "train", "truck")


def draw_detections(frame: np.ndarray, detections: list[dict]) -> None:
    for det in detections:
        x0, y0, x1, y1 = (int(v) for v in det["bbox_xyxy"])
        label = f"{det['class_name']} {det['confidence']:.2f}"
        color = (0, 165, 255) if det["class_name"] == "truck" else (0, 200, 0)
        cv2.rectangle(frame, (x0, y0), (x1, y1), color, 2)
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
        cv2.rectangle(frame, (x0, max(0, y0 - th - 6)), (x0 + tw + 4, y0), color, -1)
        cv2.putText(
            frame,
            label,
            (x0 + 2, max(th + 2, y0 - 4)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (0, 0, 0),
            1,
            cv2.LINE_AA,
        )


def extract_detections(
    result,
    class_id_map: dict[int, int],
    class_names: list[str],
) -> list[dict]:
    detections: list[dict] = []
    if result.boxes is None or len(result.boxes) == 0:
        return detections
    for box in result.boxes:
        coco_id = int(box.cls.item())
        if coco_id not in class_id_map:
            continue
        local_id = class_id_map[coco_id]
        x0, y0, x1, y1 = (float(v) for v in box.xyxy[0].tolist())
        detections.append(
            {
                "class_id": local_id,
                "class_name": class_names[local_id],
                "coco_class_id": coco_id,
                "confidence": float(box.conf.item()),
                "bbox_xyxy": [x0, y0, x1, y1],
            }
        )
    return detections


def process_video(
    model: YOLO,
    video_path: Path,
    output_dir: Path,
    class_id_map: dict[int, int],
    class_names: list[str],
    coco_ids: list[int],
    conf: float,
    force: bool,
    max_frames: int | None,
) -> dict:
    stem = video_path.stem
    output_video = output_dir / f"{stem}_annotated.mp4"
    summary_path = output_dir / f"{stem}.json"

    if output_video.exists() and not force:
        if summary_path.exists():
            return json.loads(summary_path.read_text())
        return {
            "video": video_path.name,
            "output_video": output_video.name,
            "skipped": True,
            "total_detections": 0,
            "frames_with_detections": 0,
            "frames_processed": 0,
        }

    width, height, fps, frame_count = probe_video(video_path)
    if max_frames is not None:
        frame_count = min(frame_count, max_frames)

    frame_bytes = width * height * 3
    reader = open_frame_reader(video_path)
    writer = open_frame_writer(output_video, width, height, fps)
    assert reader.stdout is not None and writer.stdin is not None

    total_detections = 0
    frames_with_detections = 0
    processed_frames = 0

    try:
        for _ in tqdm(range(frame_count), desc=stem, leave=False, unit="frame"):
            raw = reader.stdout.read(frame_bytes)
            if len(raw) < frame_bytes:
                break
            frame = np.frombuffer(raw, dtype=np.uint8).reshape((height, width, 3)).copy()
            results = model.predict(
                source=frame, conf=conf, classes=coco_ids, verbose=False
            )
            detections = extract_detections(results[0], class_id_map, class_names)
            if detections:
                frames_with_detections += 1
                total_detections += len(detections)
                draw_detections(frame, detections)
            writer.stdin.write(frame.tobytes())
            processed_frames += 1
    finally:
        reader.stdout.close()
        writer.stdin.close()
        reader.wait(timeout=60)
        writer.wait(timeout=120)

    summary = {
        "video": video_path.name,
        "model": MODEL_NAME,
        "output_video": output_video.name,
        "width": width,
        "height": height,
        "fps": fps,
        "frames_processed": processed_frames,
        "frames_with_detections": frames_with_detections,
        "total_detections": total_detections,
        "classes": class_names,
    }
    summary_path.write_text(json.dumps(summary, indent=2) + "\n")
    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=INPUT_DIR)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--model", default=MODEL_NAME)
    parser.add_argument("--confidence", type=float, default=0.25)
    parser.add_argument("--video-id", default=None, help="Process a single video stem")
    parser.add_argument("--limit", type=int, default=None, help="Process first N videos")
    parser.add_argument(
        "--max-frames",
        type=int,
        default=None,
        help="Process at most N frames per video (for testing)",
    )
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not args.input_dir.is_dir():
        print(f"Input directory not found: {args.input_dir}", file=sys.stderr)
        return 1

    videos = sorted(
        path
        for path in args.input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS
    )
    if args.video_id:
        videos = [path for path in videos if path.stem == args.video_id]
    if args.limit is not None:
        videos = videos[: args.limit]
    if not videos:
        print(f"No videos found in {args.input_dir}", file=sys.stderr)
        return 1

    print(f"Loading {args.model}...")
    model = YOLO(args.model)
    name_to_coco = {name: idx for idx, name in model.names.items()}
    class_names = [name for name in VEHICLE_CLASSES if name in name_to_coco]
    class_id_map = {
        name_to_coco[name]: local_id for local_id, name in enumerate(class_names)
    }
    coco_ids = list(class_id_map.keys())
    if not coco_ids:
        print("No vehicle classes found in model names.", file=sys.stderr)
        return 1

    args.output_dir.mkdir(parents=True, exist_ok=True)

    processed = 0
    for video_path in tqdm(videos, desc="Videos", unit="video"):
        summary = process_video(
            model,
            video_path,
            args.output_dir,
            class_id_map,
            class_names,
            coco_ids,
            args.confidence,
            args.force,
            args.max_frames,
        )
        processed += 1
        tqdm.write(
            f"{video_path.name}: {summary['total_detections']} detection(s) "
            f"across {summary['frames_with_detections']}/"
            f"{summary['frames_processed']} frame(s) → {summary['output_video']}"
        )

    print(f"Done. Processed {processed} video(s). Output: {args.output_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
