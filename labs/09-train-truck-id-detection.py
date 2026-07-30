#!/usr/bin/env python3
"""Train YOLO models for Truck ID detection, segmentation, and oriented bounding boxes.

This script fine-tunes yolo26n, yolo26n-seg, and yolo26n-obb models on the extracted
truck ID dataset, and outputs the best trained weights to the models folder.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from datetime import datetime
from pathlib import Path
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent.parent


def filter_dataset(base_dir: Path, filtered_dir: Path, ocr_results_dir: Path) -> None:
    """Generate a filtered copy of the dataset containing only 3-4 digit numbers."""
    import json, re, shutil
    print(f"Filtering dataset to {filtered_dir}...")
    ocr_results = {}
    if ocr_results_dir.exists():
        for json_path in ocr_results_dir.glob("*.json"):
            try:
                data = json.loads(json_path.read_text())
                ocr_results[json_path.stem] = {
                    d["detection_index"]: d.get("text", "").strip()
                    for d in data.get("detections", [])
                }
            except Exception as e:
                print(f"Warning: Failed to load {json_path}: {e}")

    # Reset filtered directory
    if filtered_dir.exists():
        shutil.rmtree(filtered_dir)
    for sub in ["images", "labels", "labels_seg"]:
        (filtered_dir / sub).mkdir(parents=True, exist_ok=True)

    pattern = re.compile(r"^\d{3,4}$")
    for txt_file in (base_dir / "labels").glob("*.txt"):
        frame = txt_file.stem
        det_lines = txt_file.read_text().splitlines()
        seg_file = base_dir / "labels_seg" / txt_file.name
        seg_lines = seg_file.read_text().splitlines() if seg_file.exists() else []

        valid_det, valid_seg = [], []
        frame_ocr = ocr_results.get(frame, {})
        for idx, line in enumerate(det_lines):
            if pattern.match(frame_ocr.get(idx, "")):
                valid_det.append(line)
                if idx < len(seg_lines):
                    valid_seg.append(seg_lines[idx])

        if valid_det:
            for ext in [".jpg", ".jpeg", ".png", ".webp"]:
                img_src = base_dir / "images" / f"{frame}{ext}"
                if img_src.exists():
                    shutil.copy2(img_src, filtered_dir / "images" / f"{frame}{ext}")
                    (filtered_dir / "labels" / txt_file.name).write_text("\n".join(valid_det) + "\n")
                    if valid_seg:
                        (filtered_dir / "labels_seg" / txt_file.name).write_text("\n".join(valid_seg) + "\n")
                    break

    (filtered_dir / "data.yaml").write_text(f"path: {filtered_dir.resolve()}\ntrain: images\nval: images\nnames:\n  0: truck_id\n")
    print("Filtered dataset complete.")


def train_model(
    task: str,
    variant: str,
    epochs: int,
    batch: int,
    imgsz: int,
    device: str,
    version: int,
    filter_numeric: bool = False,
) -> Path:
    """Train a single YOLO model (detection, segmentation, or oriented bounding box)."""
    if filter_numeric:
        base_dir = ROOT / "data" / "03-extract-truck-id-filtered"
        ocr_results_dir = ROOT / "data" / "04-ocr-truck-id-using-paddle-ocr-vl-1.6" / "results"
        filter_dataset(ROOT / "data" / "03-extract-truck-id", base_dir, ocr_results_dir)
    else:
        base_dir = ROOT / "data" / "03-extract-truck-id"
        
    data_yaml = base_dir / "data.yaml"

    labels_dir = base_dir / "labels"
    labels_seg_dir = base_dir / "labels_seg"
    labels_det_tmp = base_dir / "labels_det_tmp"
    labels_obb_dir = base_dir / "labels_obb"

    swapped_seg = False
    swapped_obb = False

    # 1. Choose model weights and prepare directories
    if task == "det":
        pretrained_weights = ROOT / f"yolo26{variant}.pt"
        if not pretrained_weights.exists():
            pretrained_weights = Path(f"yolo26{variant}.pt")

    elif task == "seg":
        pretrained_weights = ROOT / f"yolo26{variant}-seg.pt"
        if not pretrained_weights.exists():
            pretrained_weights = Path(f"yolo26{variant}-seg.pt")

        # Temporarily swap labels and labels_seg so YOLO sees segment annotations in 'labels'
        print("Temporarily swapping labels and labels_seg for segmentation training...")
        if labels_dir.exists() and labels_seg_dir.exists():
            labels_dir.rename(labels_det_tmp)
            labels_seg_dir.rename(labels_dir)
            swapped_seg = True
        else:
            raise FileNotFoundError("Could not find labels or labels_seg directories for swapping.")

    else:  # obb
        pretrained_weights = ROOT / f"yolo26{variant}-obb.pt"
        if not pretrained_weights.exists():
            pretrained_weights = Path(f"yolo26{variant}-obb.pt")

        # Generate OBB labels dynamically from segmentation polygons
        print("Generating OBB labels from segmentation polygons...")
        import cv2
        import numpy as np
        labels_obb_dir.mkdir(exist_ok=True)
        for txt_file in labels_seg_dir.glob("*.txt"):
            dst_file = labels_obb_dir / txt_file.name
            lines = []
            if txt_file.stat().st_size > 0:
                for line in txt_file.read_text().splitlines():
                    parts = line.strip().split()
                    if len(parts) < 7:
                        continue
                    class_id = parts[0]
                    coords = list(map(float, parts[1:]))
                    points = np.array(coords).reshape(-1, 2)
                    rect = cv2.minAreaRect(points.astype(np.float32))
                    box = cv2.boxPoints(rect)
                    box = np.clip(box, 0.0, 1.0)
                    obb_line = f"{class_id} " + " ".join(f"{val:.6f}" for val in box.reshape(-1))
                    lines.append(obb_line)
            dst_file.write_text("\n".join(lines) + ("\n" if lines else ""))

        # Temporarily swap labels and labels_obb so YOLO sees OBB annotations in 'labels'
        print("Temporarily swapping labels and labels_obb for OBB training...")
        if labels_dir.exists() and labels_obb_dir.exists():
            labels_dir.rename(labels_det_tmp)
            labels_obb_dir.rename(labels_dir)
            swapped_obb = True
        else:
            raise FileNotFoundError("Could not find labels or labels_obb directories for swapping.")

    try:
        # 2. Instantiate YOLO model
        print(f"\n--- Training {task.upper()} model using {pretrained_weights} ---")
        model = YOLO(str(pretrained_weights))

        # 3. Train
        project_dir = ROOT / "runs"
        run_name = f"train_{task}"
        model.train(
            data=str(data_yaml),
            epochs=epochs,
            batch=batch,
            imgsz=imgsz,
            device=device,
            project=str(project_dir),
            name=run_name,
            exist_ok=True,
        )

        # 4. Locate best weights
        best_weights = project_dir / run_name / "weights" / "best.pt"
        if not best_weights.exists():
            raise FileNotFoundError(f"Trained weights not found at {best_weights}")

        # 5. Output to models folder
        models_dir = ROOT / "models"
        models_dir.mkdir(exist_ok=True)

        today = datetime.now().strftime("%Y%m%d")
        filter_suffix = "-numeric-filtered" if filter_numeric else ""
        output_filename = f"truck-id-yolo26{variant}-{task}-v{version}{filter_suffix}-{today}.pt"
        dest_path = models_dir / output_filename

        shutil.copy(best_weights, dest_path)
        print(f"Successfully saved trained {task} model to {dest_path}")
        return dest_path

    finally:
        if swapped_seg:
            print("Restoring original labels and labels_seg directories...")
            if labels_dir.exists() and labels_det_tmp.exists():
                labels_dir.rename(labels_seg_dir)
                labels_det_tmp.rename(labels_dir)
            elif labels_det_tmp.exists() and not labels_dir.exists():
                labels_det_tmp.rename(labels_dir)

        if swapped_obb:
            print("Restoring original labels and removing temporary OBB directories...")
            if labels_dir.exists() and labels_det_tmp.exists():
                labels_dir.rename(labels_obb_dir)
                labels_det_tmp.rename(labels_dir)
            elif labels_det_tmp.exists() and not labels_dir.exists():
                labels_det_tmp.rename(labels_dir)
            if labels_obb_dir.exists():
                shutil.rmtree(labels_obb_dir)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Truck ID YOLO detection, segmentation, and OBB models.")
    parser.add_argument("--task", choices=["det", "seg", "obb", "all"], default="all", help="Task to train: det, seg, obb, or all")
    parser.add_argument("--variant", default="n", help="YOLO variant (e.g. n)")
    parser.add_argument("--epochs", type=int, default=200, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size")
    parser.add_argument("--device", default="", help="Device override (e.g. cpu, cuda, or empty for auto)")
    parser.add_argument("--version", type=int, default=1, help="Version number for output filename")
    parser.add_argument("--filter-numeric", action="store_true", help="Only use bboxes containing 3-4 digit numbers from OCR results")

    args = parser.parse_args()

    # Decide device
    if args.device:
        device = args.device
    else:
        try:
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            device = "cpu"

    tasks = ["det", "seg", "obb"] if args.task == "all" else [args.task]

    for task in tasks:
        train_model(
            task=task,
            variant=args.variant,
            epochs=args.epochs,
            batch=args.batch,
            imgsz=args.imgsz,
            device=device,
            version=args.version,
            filter_numeric=args.filter_numeric,
        )


if __name__ == "__main__":
    main()
