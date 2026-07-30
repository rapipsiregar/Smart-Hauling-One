#!/usr/bin/env python3
"""Detect truck ID using YOLO and run PaddleOCR-VL on the cropped box."""

import argparse
import sys
import time
from pathlib import Path
import cv2
import numpy as np
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
    parser.add_argument(
        "--model",
        type=Path,
        required=True,
        help="Path to YOLO model (.pt)",
    )
    parser.add_argument(
        "--image",
        type=Path,
        required=True,
        help="Path to test image",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Path to save annotated image",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
        help="YOLO confidence threshold",
    )
    parser.add_argument(
        "--padding",
        type=float,
        default=0.1,
        help="OCR crop padding ratio",
    )
    parser.add_argument(
        "--device",
        default=None,
        help="OCR device (e.g. cuda, cpu)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not args.model.exists():
        print(f"Error: Model not found at {args.model}", file=sys.stderr)
        return 1
    if not args.image.exists():
        print(f"Error: Image not found at {args.image}", file=sys.stderr)
        return 1

    # Load YOLO Model
    print(f"Loading YOLO model: {args.model}...")
    model = YOLO(str(args.model))

    # Read Image
    print(f"Reading image: {args.image}...")
    img = cv2.imread(str(args.image))
    if img is None:
        print(f"Error: Could not read image {args.image}", file=sys.stderr)
        return 1

    # Detect
    print(f"Running detection (conf={args.conf})...")
    results = model.predict(source=img, conf=args.conf, verbose=False)
    result = results[0]

    if result.boxes is None or len(result.boxes) == 0:
        print("No truck ID detections found. Cannot run OCR.", file=sys.stderr)
        return 1

    # Load OCR Pipeline
    print("Loading PaddleOCR VL 1.6 pipeline...")
    ocr = build_ocr_pipeline(args.device)

    temp_crop_dir = ROOT / "data" / "test_output" / "temp_crops"
    temp_crop_dir.mkdir(parents=True, exist_ok=True)

    print(f"Found {len(result.boxes)} detection(s). Running OCR...")
    for idx, box in enumerate(result.boxes):
        x0, y0, x1, y1 = map(int, box.xyxy[0].tolist())
        conf = float(box.conf.item())

        # Crop detection with padding
        crop, crop_bbox = crop_detection(img, [x0, y0, x1, y1], args.padding)
        if crop.size == 0:
            continue

        # Save temporary crop image for PaddleOCR
        crop_path = temp_crop_dir / f"crop_{idx:02d}.jpg"
        cv2.imwrite(str(crop_path), crop)

        # Run OCR
        start_time = time.perf_counter()
        ocr_out = ocr.predict(str(crop_path), use_layout_detection=False, prompt_label="ocr")
        ocr_text = ""
        for out in ocr_out:
            blocks = out.json.get("res", {}).get("parsing_res_list", [])
            ocr_text = " ".join([b.get("block_content", "").strip() for b in blocks if b.get("block_content")]).strip()
            break
        elapsed = time.perf_counter() - start_time

        print(f"  [{idx}] Box: [{x0}, {y0}, {x1}, {y1}], Detect Conf: {conf:.4f}")
        print(f"      OCR Result: \"{ocr_text}\" (took {elapsed:.4f}s)")

        # Draw box and OCR text on image
        color = (0, 255, 0)
        cv2.rectangle(img, (x0, y0), (x1, y1), color, 2)
        label = f"OCR: {ocr_text} ({conf:.2f})"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
        cv2.rectangle(img, (x0, max(0, y0 - th - 6)), (x0 + tw + 4, y0), color, -1)
        cv2.putText(
            img,
            label,
            (x0 + 2, max(th + 2, y0 - 4)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (0, 0, 0),
            1,
            cv2.LINE_AA,
        )

        # Clean up temp crop file
        if crop_path.exists():
            crop_path.unlink()

    # Clean up temp directory
    try:
        temp_crop_dir.rmdir()
    except Exception:
        pass

    # Save output image
    if args.output is None:
        output_dir = ROOT / "data" / "test_output"
        output_dir.mkdir(parents=True, exist_ok=True)
        args.output = output_dir / f"{args.image.stem}_ocr_annotated{args.image.suffix}"

    args.output.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(args.output), img)
    print(f"Successfully saved OCR annotated image to {args.output}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
