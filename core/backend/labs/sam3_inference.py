#!/usr/bin/env python3
"""SAM3 inference and processor helper functions."""

from __future__ import annotations

import json
import sys
from pathlib import Path
import torch
from PIL import Image
import numpy as np

# We can append current path to sys.path to allow relative modules import when running dynamically
sys.path.append(str(Path(__file__).resolve().parent))
from yolo_utils import (
    CLASS_ID,
    CLASS_NAME,
    xyxy_to_yolo_bbox,
    mask_to_yolo_polygon,
    write_yolo_bbox_label,
    write_yolo_seg_label,
    save_annotated_image,
)


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
