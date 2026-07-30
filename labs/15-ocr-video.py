#!/usr/bin/env python3
"""Run YOLO detector and PaddleOCR VL 1.6 sequentially frame-by-frame on a video."""

import argparse
import sys
import time
from pathlib import Path
import cv2
import numpy as np
from tqdm import tqdm
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent.parent


def crop_detection(
    image: np.ndarray,
    bbox_xyxy: list[float],
    padding_ratio: float,
) -> tuple[np.ndarray, list[int]]:
    img_h, img_w = image.shape[:2]
    x0, y0, x1, y1 = bbox_xyxy
    pad_w = (x1 - x0) * padding_ratio
    pad_h = (y1 - y0) * padding_ratio
    crop_x0 = max(0, int(x0 - pad_w))
    crop_y0 = max(0, int(y0 - pad_h))
    crop_x1 = min(img_w, int(x1 + pad_w))
    crop_y1 = min(img_h, int(y1 + pad_h))
    return image[crop_y0:crop_y1, crop_x0:crop_x1], [crop_x0, crop_y0, crop_x1, crop_y1]


def build_ocr_pipeline(device: str | None):
    from paddleocr import PaddleOCRVL
    kwargs = {
        "pipeline_version": "v1.6",
        "engine": "transformers",
        "use_layout_detection": False,
    }
    if device is not None:
        kwargs["device"] = device
    return PaddleOCRVL(**kwargs)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True, help="Path to YOLO model (.pt)")
    parser.add_argument("--video", type=Path, required=True, help="Path to input video")
    parser.add_argument("--output", type=Path, default=None, help="Path to save annotated video")
    parser.add_argument("--conf", type=float, default=0.25, help="YOLO confidence threshold")
    parser.add_argument("--padding", type=float, default=0.1, help="OCR crop padding ratio")
    parser.add_argument("--device", default="", help="Device override (e.g. cpu, cuda, or GPU index)")
    parser.add_argument("--max-frames", type=int, default=None, help="Process at most N frames")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not args.model.exists():
        print(f"Error: Model not found at {args.model}", file=sys.stderr)
        return 1
    if not args.video.exists():
        print(f"Error: Video not found at {args.video}", file=sys.stderr)
        return 1

    if args.output is None:
        output_dir = ROOT / "data" / "test_output"
        output_dir.mkdir(parents=True, exist_ok=True)
        args.output = output_dir / f"{args.video.stem}_ocr_annotated{args.video.suffix}"

    args.output.parent.mkdir(parents=True, exist_ok=True)

    # Resolve device for YOLO vs PaddleOCR
    yolo_device = None
    ocr_device = None
    if args.device:
        # For YOLO
        if args.device.isdigit():
            yolo_device = int(args.device)
        else:
            yolo_device = args.device
        
        # For PaddleOCR
        if args.device.isdigit() or "cuda" in args.device.lower():
            gpu_idx = "".join(filter(str.isdigit, args.device))
            ocr_device = f"gpu:{gpu_idx}" if gpu_idx else "gpu"
        else:
            ocr_device = args.device

    # Load YOLO Model
    print(f"Loading YOLO model: {args.model} on device {yolo_device}...")
    model = YOLO(str(args.model))

    # Load OCR Pipeline
    print(f"Loading PaddleOCR VL 1.6 pipeline on device {ocr_device}...")
    ocr = build_ocr_pipeline(ocr_device)

    # Open Video
    cap = cv2.VideoCapture(str(args.video))
    if not cap.isOpened():
        print(f"Error: Could not open video {args.video}", file=sys.stderr)
        return 1

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if args.max_frames is not None:
        total_frames = min(total_frames, args.max_frames)

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(args.output), fourcc, fps, (width, height))

    temp_crop_dir = ROOT / "data" / "test_output" / "temp_crops_video"
    temp_crop_dir.mkdir(parents=True, exist_ok=True)

    print(f"Processing video: {args.video.name} ({total_frames} frames) -> {args.output.name}")
    try:
        for f_idx in tqdm(range(total_frames), desc="Frames", unit="frame"):
            ret, frame = cap.read()
            if not ret:
                break

            # Run YOLO Detection
            results = model.predict(source=frame, conf=args.conf, device=yolo_device, verbose=False)
            result = results[0]

            if result.boxes is not None and len(result.boxes) > 0:
                for b_idx, box in enumerate(result.boxes):
                    x0, y0, x1, y1 = map(int, box.xyxy[0].tolist())
                    conf = float(box.conf.item())

                    # Crop
                    crop, crop_bbox = crop_detection(frame, [x0, y0, x1, y1], args.padding)
                    if crop.size == 0:
                        continue

                    # Save crop temporarily
                    crop_path = temp_crop_dir / f"crop_{f_idx:04d}_{b_idx:02d}.jpg"
                    cv2.imwrite(str(crop_path), crop)

                    # Run OCR
                    ocr_out = ocr.predict(str(crop_path), use_layout_detection=False, prompt_label="ocr")
                    ocr_text = ""
                    for out in ocr_out:
                        blocks = out.json.get("res", {}).get("parsing_res_list", [])
                        ocr_text = " ".join([b.get("block_content", "").strip() for b in blocks if b.get("block_content")]).strip()
                        break

                    # Draw detections
                    color = (0, 255, 0)
                    cv2.rectangle(frame, (x0, y0), (x1, y1), color, 2)
                    label = f"OCR: {ocr_text} ({conf:.2f})"
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

                    # Cleanup temp crop file
                    if crop_path.exists():
                        crop_path.unlink()

            writer.write(frame)
    finally:
        cap.release()
        writer.release()
        # Clean up temp crop dir
        for p in temp_crop_dir.glob("*.jpg"):
            try:
                p.unlink()
            except Exception:
                pass
        try:
            temp_crop_dir.rmdir()
        except Exception:
            pass

    print(f"Successfully saved video OCR to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
