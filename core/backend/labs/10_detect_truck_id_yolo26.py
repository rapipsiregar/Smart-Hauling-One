#!/usr/bin/env python3
"""Run YOLO26n fine-tuned models on converted videos to detect/segment truck IDs."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from tqdm import tqdm
from ultralytics import YOLO

# Add current folder to sys.path for relative imports to resolve when executing directly
sys.path.append(str(Path(__file__).resolve().parent))
from yolo26_video_io import open_frame_reader, open_frame_writer, probe_video

ROOT = Path(__file__).resolve().parent.parent
SLUG = "detect-truck-id-using-yolo26"
INPUT_DIR = ROOT / "data" / "01b-videos-converted-to-mp4"
VIDEO_EXTENSIONS = {".webm", ".mkv", ".mp4", ".avi", ".mov"}


def find_model_variants(model_dir: Path) -> dict[str, Path]:
    """Find available model variants in the models folder."""
    variants = {}
    pt_files = sorted(model_dir.glob("*.pt")) if model_dir.exists() else []
    for path in pt_files:
        name = path.name.lower()
        if "-seg" in name:
            variants["seg"] = path
        elif "-obb" in name:
            variants["obb"] = path
        elif "-det" in name or "det" in name:
            variants["det"] = path
    return variants


def draw_detections(frame: np.ndarray, result, task: str, color=(0, 255, 0)) -> int:
    """Draw predicted standard bounding boxes, masks, or oriented boxes on a frame."""
    drawn_count = 0

    if task == "det":
        if result.boxes is not None:
            for box in result.boxes:
                x0, y0, x1, y1 = map(int, box.xyxy[0].tolist())
                conf = float(box.conf.item())
                label = f"truck_id {conf:.2f}"
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
                drawn_count += 1

    elif task == "seg":
        if result.masks is not None:
            for mask, box in zip(result.masks, result.boxes):
                x0, y0, x1, y1 = map(int, box.xyxy[0].tolist())
                cv2.rectangle(frame, (x0, y0), (x1, y1), color, 1)

                poly_coords = mask.xy[0]
                if len(poly_coords) > 0:
                    pts = np.array(poly_coords, dtype=np.int32).reshape((-1, 1, 2))
                    overlay = frame.copy()
                    cv2.fillPoly(overlay, [pts], color)
                    cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)
                    cv2.polylines(frame, [pts], isClosed=True, color=color, thickness=2)

                conf = float(box.conf.item())
                label = f"truck_id {conf:.2f}"
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
                drawn_count += 1

    elif task == "obb":
        if result.obb is not None:
            for points, conf in zip(result.obb.xyxyxyxy, result.obb.conf):
                pts = np.array(points.tolist(), dtype=np.int32).reshape((-1, 1, 2))
                cv2.polylines(frame, [pts], isClosed=True, color=color, thickness=2)

                sorted_pts = sorted(points.tolist(), key=lambda p: (p[1], p[0]))
                x0, y0 = map(int, sorted_pts[0])

                label = f"truck_id {float(conf.item()):.2f}"
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
                drawn_count += 1

    return drawn_count


def process_video(
    model: YOLO,
    task: str,
    video_path: Path,
    output_dir: Path,
    conf: float,
    force: bool,
    max_frames: int | None,
) -> dict:
    """Run model prediction on a video stream and save the annotated output video."""
    stem = video_path.stem
    output_video = output_dir / f"{stem}_annotated.mp4"
    summary_path = output_dir / f"{stem}.json"

    if output_video.exists() and not force:
        if summary_path.exists():
            return json.loads(summary_path.read_text())
        return {"video": video_path.name, "skipped": True}

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
        for _ in tqdm(range(frame_count), desc=f"{stem} ({task})", leave=False, unit="frame"):
            raw = reader.stdout.read(frame_bytes)
            if len(raw) < frame_bytes:
                break
            frame = np.frombuffer(raw, dtype=np.uint8).reshape((height, width, 3)).copy()
            results = model.predict(source=frame, conf=conf, verbose=False)
            count = draw_detections(frame, results[0], task)
            if count > 0:
                frames_with_detections += 1
                total_detections += count
            writer.stdin.write(frame.tobytes())
            processed_frames += 1
    finally:
        reader.stdout.close()
        writer.stdin.close()
        reader.wait(timeout=60)
        writer.wait(timeout=120)

    summary = {
        "video": video_path.name,
        "model_task": task,
        "output_video": output_video.name,
        "frames_processed": processed_frames,
        "frames_with_detections": frames_with_detections,
        "total_detections": total_detections,
    }
    summary_path.write_text(json.dumps(summary, indent=2) + "\n")
    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=INPUT_DIR, help="Source videos directory")
    parser.add_argument("--task", choices=["det", "seg", "obb", "all"], default="all", help="Task model variant to run")
    parser.add_argument("--confidence", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--video-id", default=None, help="Process a single video by stem name")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of videos to process")
    parser.add_argument("--max-frames", type=int, default=None, help="Process at most N frames per video")
    parser.add_argument("--force", action="store_true", help="Reprocess even if output exists")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not args.input_dir.is_dir():
        print(f"Input directory not found: {args.input_dir}", file=sys.stderr)
        return 1

    variants = find_model_variants(ROOT / "models")
    if args.task != "all":
        variants = {k: v for k, v in variants.items() if k == args.task}

    if not variants:
        print(f"No model variants found for task: {args.task}", file=sys.stderr)
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
        print(f"No videos found to process in {args.input_dir}", file=sys.stderr)
        return 1

    # Pre-load all available models to avoid reloading overhead
    loaded_models = {}
    for task, model_path in variants.items():
        print(f"Loading YOLO model: {model_path} ({task.upper()} task)...")
        loaded_models[task] = YOLO(str(model_path))

    processed = 0
    for video_path in tqdm(videos, desc="Videos", unit="video"):
        tqdm.write(f"\n=== Processing video: {video_path.name} ===")

        # Run task loop sequentially for each video: det -> seg -> obb
        for task in ["det", "seg", "obb"]:
            if task not in loaded_models:
                continue

            output_dir = ROOT / "data" / f"10-{SLUG}-{task}"
            output_dir.mkdir(parents=True, exist_ok=True)

            model = loaded_models[task]
            summary = process_video(
                model=model,
                task=task,
                video_path=video_path,
                output_dir=output_dir,
                conf=args.confidence,
                force=args.force,
                max_frames=args.max_frames,
            )
            tqdm.write(
                f"  {task.upper()} task: {summary.get('total_detections', 0)} detection(s) "
                f"across {summary.get('frames_with_detections', 0)}/{summary.get('frames_processed', 0)} frame(s) "
                f"→ {summary.get('output_video')}"
            )
        processed += 1

    print(f"\nDone. Run completed successfully for {processed} video(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
