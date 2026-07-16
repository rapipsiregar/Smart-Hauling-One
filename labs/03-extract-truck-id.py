#!/usr/bin/env python3
"""Segment truck ID regions in extracted frames using SAM3 and export YOLO labels."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np
import supervision as sv
import torch
from PIL import Image
from tqdm import tqdm

ROOT = Path(__file__).resolve().parent.parent
SLUG = "extract-truck-id"
INPUT_DIR = ROOT / "data" / "02-extracted-images-from-videos"
OUTPUT_DIR = ROOT / "data" / f"03-{SLUG}"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
CLASS_NAME = "truck_id"
CLASS_ID = 0
DEFAULT_TEXT_PROMPT = "truck number"
FRAME_NAME_RE = re.compile(r"^(.+)_frame\d+$")


def xyxy_to_yolo_bbox(box: np.ndarray, img_w: int, img_h: int) -> tuple[float, float, float, float]:
    x0, y0, x1, y1 = box.tolist()
    cx = ((x0 + x1) / 2) / img_w
    cy = ((y0 + y1) / 2) / img_h
    w = (x1 - x0) / img_w
    h = (y1 - y0) / img_h
    return cx, cy, w, h


def mask_to_yolo_polygon(mask: np.ndarray, img_w: int, img_h: int) -> list[float]:
    mask_uint8 = (mask.astype(np.uint8) * 255)
    contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return []
    contour = max(contours, key=cv2.contourArea)
    if len(contour) < 3:
        return []
    points = contour.reshape(-1, 2).astype(float)
    points[:, 0] /= img_w
    points[:, 1] /= img_h
    points = np.clip(points, 0.0, 1.0)
    return points.reshape(-1).tolist()


def write_yolo_bbox_label(path: Path, detections: list[dict]) -> None:
    lines = []
    for det in detections:
        cx, cy, w, h = det["yolo_bbox"]
        lines.append(f"{CLASS_ID} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
    path.write_text("\n".join(lines) + ("\n" if lines else ""))


def write_yolo_seg_label(path: Path, detections: list[dict]) -> None:
    lines = []
    for det in detections:
        polygon = det["yolo_polygon"]
        if len(polygon) < 6:
            continue
        coords = " ".join(f"{value:.6f}" for value in polygon)
        lines.append(f"{CLASS_ID} {coords}")
    path.write_text("\n".join(lines) + ("\n" if lines else ""))


def yolo_polygon_to_points(polygon: list[float], img_w: int, img_h: int) -> np.ndarray:
    points = np.array(polygon, dtype=np.float32).reshape(-1, 2)
    points[:, 0] *= img_w
    points[:, 1] *= img_h
    return points.astype(np.int32)


def yolo_polygon_to_mask(polygon: list[float], img_w: int, img_h: int) -> np.ndarray:
    mask = np.zeros((img_h, img_w), dtype=np.uint8)
    if len(polygon) < 6:
        return mask.astype(bool)
    points = yolo_polygon_to_points(polygon, img_w, img_h)
    cv2.fillPoly(mask, [points], 1)
    return mask.astype(bool)


def detections_to_supervision(
    detections: list[dict],
    img_w: int,
    img_h: int,
) -> sv.Detections:
    if not detections:
        return sv.Detections.empty()

    xyxy = np.array([det["bbox_xyxy"] for det in detections], dtype=np.float32)
    confidence = np.array([det["score"] for det in detections], dtype=np.float32)
    class_id = np.full(len(detections), CLASS_ID, dtype=int)
    masks = np.stack(
        [yolo_polygon_to_mask(det.get("yolo_polygon", []), img_w, img_h) for det in detections]
    )

    return sv.Detections(
        xyxy=xyxy,
        mask=masks,
        confidence=confidence,
        class_id=class_id,
    )


def save_annotated_image(
    image_path: Path,
    output_path: Path,
    detections: list[dict],
    img_w: int,
    img_h: int,
) -> None:
    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError(f"Could not read image: {image_path}")

    sv_detections = detections_to_supervision(detections, img_w, img_h)

    mask_annotator = sv.MaskAnnotator()
    box_annotator = sv.BoxAnnotator()

    annotated = image.copy()
    annotated = mask_annotator.annotate(scene=annotated, detections=sv_detections)
    annotated = box_annotator.annotate(scene=annotated, detections=sv_detections)
    cv2.imwrite(str(output_path), annotated)


def build_processor(confidence_threshold: float):
    from sam3 import build_sam3_image_model
    from sam3.model.sam3_image_processor import Sam3Processor

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        print("Warning: CUDA not available, running on CPU.", file=sys.stderr)

    model = build_sam3_image_model(device=device, eval_mode=True)
    return Sam3Processor(model, device=device, confidence_threshold=confidence_threshold)


def detect_truck_ids(processor, image_path: Path, text_prompt: str) -> tuple[list[dict], int, int]:
    image = Image.open(image_path).convert("RGB")
    img_w, img_h = image.size

    device_type = processor.device
    with torch.inference_mode():
        if device_type == "cuda":
            with torch.autocast(device_type="cuda", dtype=torch.bfloat16):
                inference_state = processor.set_image(image)
                inference_state = processor.set_text_prompt(
                    state=inference_state, prompt=text_prompt
                )
        else:
            inference_state = processor.set_image(image)
            inference_state = processor.set_text_prompt(
                state=inference_state, prompt=text_prompt
            )

    boxes = inference_state["boxes"].detach().float().cpu().numpy()
    masks = inference_state["masks"].detach().float().cpu().numpy()
    scores = inference_state["scores"].detach().float().cpu().numpy()

    detections: list[dict] = []
    for box, mask, score in zip(boxes, masks, scores, strict=True):
        mask_2d = mask.squeeze()
        yolo_bbox = xyxy_to_yolo_bbox(box, img_w, img_h)
        yolo_polygon = mask_to_yolo_polygon(mask_2d, img_w, img_h)
        if len(yolo_polygon) < 6:
            continue
        detections.append(
            {
                "score": float(score),
                "bbox_xyxy": [float(v) for v in box.tolist()],
                "yolo_bbox": yolo_bbox,
                "yolo_polygon": yolo_polygon,
            }
        )

    return detections, img_w, img_h


def video_id_from_frame(path: Path) -> str:
    match = FRAME_NAME_RE.match(path.stem)
    return match.group(1) if match else path.stem


def group_frames_by_video(frames: list[Path]) -> list[tuple[str, list[Path]]]:
    groups: dict[str, list[Path]] = defaultdict(list)
    for path in frames:
        groups[video_id_from_frame(path)].append(path)
    return [(video_id, sorted(video_frames)) for video_id, video_frames in sorted(groups.items())]


def ensure_dataset_layout(output_dir: Path) -> dict[str, Path]:
    dirs = {
        "images": output_dir / "images",
        "annotated": output_dir / "annotated",
        "labels": output_dir / "labels",
        "labels_seg": output_dir / "labels_seg",
        "annotations": output_dir / "annotations",
    }
    for path in dirs.values():
        path.mkdir(parents=True, exist_ok=True)
    return dirs


def write_data_yaml(output_dir: Path) -> None:
    data_yaml = (
        f"path: {output_dir}\n"
        "train: images\n"
        "val: images\n"
        "names:\n"
        f"  {CLASS_ID}: {CLASS_NAME}\n"
    )
    (output_dir / "data.yaml").write_text(data_yaml)


def process_frame(
    processor,
    image_path: Path,
    dirs: dict[str, Path],
    text_prompt: str,
    force: bool,
) -> tuple[int, int]:
    stem = image_path.stem
    bbox_label_path = dirs["labels"] / f"{stem}.txt"
    seg_label_path = dirs["labels_seg"] / f"{stem}.txt"
    annotation_path = dirs["annotations"] / f"{stem}.json"
    output_image_path = dirs["images"] / image_path.name
    annotated_image_path = dirs["annotated"] / image_path.name

    if not force and bbox_label_path.exists() and seg_label_path.exists():
        if annotation_path.exists():
            annotation = json.loads(annotation_path.read_text())
            detections = annotation.get("detections", [])
            if force or not annotated_image_path.exists():
                save_annotated_image(
                    image_path,
                    annotated_image_path,
                    detections,
                    annotation["image_width"],
                    annotation["image_height"],
                )
            return 0, len(detections)
        return 0, 0

    detections, img_w, img_h = detect_truck_ids(processor, image_path, text_prompt)

    if not output_image_path.exists() or force:
        output_image_path.write_bytes(image_path.read_bytes())

    write_yolo_bbox_label(bbox_label_path, detections)
    write_yolo_seg_label(seg_label_path, detections)
    annotation_path.write_text(
        json.dumps(
            {
                "image": image_path.name,
                "text_prompt": text_prompt,
                "image_width": img_w,
                "image_height": img_h,
                "class_name": CLASS_NAME,
                "class_id": CLASS_ID,
                "detections": detections,
            },
            indent=2,
        )
        + "\n"
    )
    save_annotated_image(image_path, annotated_image_path, detections, img_w, img_h)
    return 1, len(detections)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=INPUT_DIR,
        help="Directory of extracted frame images",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=OUTPUT_DIR,
        help="Directory for YOLO labels and annotations",
    )
    parser.add_argument(
        "--text-prompt",
        default=DEFAULT_TEXT_PROMPT,
        help="SAM3 text prompt for truck ID segmentation",
    )
    parser.add_argument(
        "--confidence-threshold",
        type=float,
        default=0.5,
        help="Minimum detection confidence",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process only the first N frames (for testing)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reprocess frames even if labels already exist",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not args.input_dir.is_dir():
        print(f"Input directory not found: {args.input_dir}", file=sys.stderr)
        return 1

    frames = sorted(
        path
        for path in args.input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )
    if args.limit is not None:
        frames = frames[: args.limit]

    if not frames:
        print(f"No images found in {args.input_dir}", file=sys.stderr)
        return 1

    video_groups = group_frames_by_video(frames)

    dirs = ensure_dataset_layout(args.output_dir)
    write_data_yaml(args.output_dir)

    print(f"Loading SAM3 (prompt={args.text_prompt!r})...")
    processor = build_processor(args.confidence_threshold)

    processed = 0
    total_detections = 0
    for video_id, video_frames in tqdm(video_groups, desc="Videos", unit="video"):
        video_detections = 0
        for image_path in tqdm(
            video_frames,
            desc=video_id,
            leave=False,
            unit="frame",
        ):
            frame_processed, frame_detections = process_frame(
                processor,
                image_path,
                dirs,
                args.text_prompt,
                args.force,
            )
            processed += frame_processed
            video_detections += frame_detections
            total_detections += frame_detections

        tqdm.write(
            f"{video_id}: {video_detections} detection(s) across {len(video_frames)} frame(s)"
        )

    print(
        f"Done. Processed {processed} new frame(s) across {len(video_groups)} video(s), "
        f"{total_detections} detection(s) total. Output: {args.output_dir}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
