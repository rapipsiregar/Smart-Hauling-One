#!/usr/bin/env python3
"""Run YOLO model inference on a single image and save the annotated output."""

import argparse
import sys
from pathlib import Path
import cv2
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model",
        type=Path,
        required=True,
        help="Path to the trained YOLO model (.pt)",
    )
    parser.add_argument(
        "--image",
        type=Path,
        required=True,
        help="Path to the source image",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Path to save the annotated output image",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
        help="Confidence threshold for prediction",
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

    # Load model
    print(f"Loading YOLO model: {args.model}...")
    model = YOLO(str(args.model))

    # Load image
    print(f"Reading image: {args.image}...")
    img = cv2.imread(str(args.image))
    if img is None:
        print(f"Error: Could not read image {args.image}", file=sys.stderr)
        return 1

    # Run inference
    print(f"Running inference (conf={args.conf})...")
    results = model.predict(source=img, conf=args.conf, verbose=False)
    result = results[0]

    detections_count = 0
    if result.boxes is not None and len(result.boxes) > 0:
        print(f"Found {len(result.boxes)} detection(s):")
        for idx, box in enumerate(result.boxes):
            x0, y0, x1, y1 = map(int, box.xyxy[0].tolist())
            conf = float(box.conf.item())
            cls_id = int(box.cls.item())
            cls_name = model.names.get(cls_id, f"class_{cls_id}")
            print(f"  [{idx}] {cls_name} (conf={conf:.4f}) -> bbox: [{x0}, {y0}, {x1}, {y1}]")

            # Draw box and label
            color = (0, 255, 0)
            cv2.rectangle(img, (x0, y0), (x1, y1), color, 2)
            label = f"{cls_name} {conf:.2f}"
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
            detections_count += 1
    else:
        print("No detections found.")

    # Save output image
    if args.output is None:
        output_dir = ROOT / "data" / "test_output"
        output_dir.mkdir(parents=True, exist_ok=True)
        args.output = output_dir / f"{args.image.stem}_annotated{args.image.suffix}"

    args.output.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(args.output), img)
    print(f"Successfully saved annotated image to {args.output}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
