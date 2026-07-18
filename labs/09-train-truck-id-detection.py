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


def train_model(
    task: str,
    variant: str,
    epochs: int,
    batch: int,
    imgsz: int,
    device: str,
    version: int,
) -> Path:
    """Train a single YOLO model (detection, segmentation, or oriented bounding box)."""
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
        output_filename = f"truck-id-yolo26{variant}-{task}-v{version}-{today}.pt"
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
        )


if __name__ == "__main__":
    main()
