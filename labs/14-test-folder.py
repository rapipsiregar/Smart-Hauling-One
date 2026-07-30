#!/usr/bin/env python3
"""Run YOLO model inference on all images and videos in a directory."""

import argparse
import sys
from pathlib import Path
import cv2
from tqdm import tqdm
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent.parent
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
VIDEO_EXTS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}


def draw_detections(frame, result, model, color=(0, 255, 0)) -> int:
    drawn_count = 0
    if result.boxes is not None:
        for box in result.boxes:
            x0, y0, x1, y1 = map(int, box.xyxy[0].tolist())
            conf = float(box.conf.item())
            cls_id = int(box.cls.item())
            cls_name = model.names.get(cls_id, f"class_{cls_id}")
            label = f"{cls_name} {conf:.2f}"

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
    return drawn_count


def process_image(model, img_path: Path, output_path: Path, conf: float, device: str) -> None:
    img = cv2.imread(str(img_path))
    if img is None:
        print(f"Warning: Could not read image {img_path}")
        return
    results = model.predict(source=img, conf=conf, device=device, verbose=False)
    draw_detections(img, results[0], model)
    cv2.imwrite(str(output_path), img)


def process_video(model, vid_path: Path, output_path: Path, conf: float, device: str) -> None:
    cap = cv2.VideoCapture(str(vid_path))
    if not cap.isOpened():
        print(f"Warning: Could not open video {vid_path}")
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(output_path), fourcc, fps, (width, height))

    for _ in tqdm(range(total_frames), desc=f"Processing {vid_path.name}", leave=False, unit="frame"):
        ret, frame = cap.read()
        if not ret:
            break
        results = model.predict(source=frame, conf=conf, device=device, verbose=False)
        draw_detections(frame, results[0], model)
        writer.write(frame)

    cap.release()
    writer.release()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True, help="Path to YOLO model (.pt)")
    parser.add_argument("--input-dir", type=Path, required=True, help="Directory containing images/videos")
    parser.add_argument("--output-dir", type=Path, default=None, help="Directory to save annotated outputs")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--device", default="", help="Device override (e.g. cpu, cuda, or GPU index)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not args.model.exists():
        print(f"Error: Model not found at {args.model}", file=sys.stderr)
        return 1
    if not args.input_dir.is_dir():
        print(f"Error: Input directory not found at {args.input_dir}", file=sys.stderr)
        return 1

    if args.output_dir is None:
        args.output_dir = ROOT / "data" / "test_output"
    args.output_dir.mkdir(parents=True, exist_ok=True)

    # Decide device
    if args.device:
        device = args.device
    else:
        try:
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            device = "cpu"

    print(f"Loading YOLO model: {args.model} on device: {device}...")
    model = YOLO(str(args.model))

    # Find files
    files = sorted(args.input_dir.iterdir())
    images = [f for f in files if f.suffix.lower() in IMAGE_EXTS]
    videos = [f for f in files if f.suffix.lower() in VIDEO_EXTS]

    print(f"Found {len(images)} image(s) and {len(videos)} video(s) in {args.input_dir}.")

    # Process images
    for img_path in images:
        out_path = args.output_dir / f"{img_path.stem}_annotated{img_path.suffix}"
        print(f"Processing image: {img_path.name} -> {out_path.name}")
        process_image(model, img_path, out_path, args.conf, device)

    # Process videos
    for vid_path in videos:
        out_path = args.output_dir / f"{vid_path.stem}_annotated{vid_path.suffix}"
        print(f"Processing video: {vid_path.name} -> {out_path.name}")
        process_video(model, vid_path, out_path, args.conf, device)

    print(f"\nDone. All outputs saved to: {args.output_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
