#!/usr/bin/env python3
"""YOLO labeling, layout management, and supervision annotation utilities."""

from __future__ import annotations

import json
from pathlib import Path
import cv2
import numpy as np
import supervision as sv

CLASS_ID = 0
CLASS_NAME = "truck_id"


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
