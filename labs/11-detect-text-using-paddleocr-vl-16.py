#!/usr/bin/env python3
"""Run PaddleOCR-VL 1.6 directly on extracted video frames to detect text and export a YOLO training dataset with det, seg, and obb labels."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np
from tqdm import tqdm
from paddleocr import PaddleOCRVL

ROOT = Path(__file__).resolve().parent.parent
SLUG = "detect-text-using-paddleocr-vl-16"
INPUT_DIR = ROOT / "data" / "02-extracted-images-from-videos"
OUTPUT_DIR = ROOT / "data" / f"11-{SLUG}"


def process_image(pipeline, img_path: Path, out_dirs: dict[str, Path], use_layout: bool, force: bool) -> int:
    img_name = img_path.name
    stem = img_path.stem
    
    img_out = out_dirs["images"] / img_name
    lbl_out = out_dirs["labels"] / f"{stem}.txt"
    seg_out = out_dirs["labels_seg"] / f"{stem}.txt"
    obb_out = out_dirs["labels_obb"] / f"{stem}.txt"
    ann_out = out_dirs["annotations"] / f"{stem}.json"
    vis_out = out_dirs["annotated"] / img_name

    if not force and all(p.exists() for p in [img_out, lbl_out, seg_out, obb_out, ann_out, vis_out]):
        return 0

    image = cv2.imread(str(img_path))
    if image is None:
        print(f"Error: Could not read source image {img_path}", file=sys.stderr)
        return 0

    img_h, img_w = image.shape[:2]
    text_dets = []
    
    # Run text detection directly on the full frame image using PaddleOCR-VL
    try:
        outputs = pipeline.predict(str(img_path), use_layout_detection=use_layout, prompt_label="ocr")
        for result in outputs:
            for block in result.json.get("res", {}).get("parsing_res_list", []):
                content = block.get("block_content", "").strip()
                bbox = block.get("block_bbox", [])
                if len(bbox) == 4 and content:
                    fx0, fy0, fx1, fy1 = bbox
                    fx0 = min(img_w, max(0, fx0))
                    fy0 = min(img_h, max(0, fy0))
                    fx1 = min(img_w, max(0, fx1))
                    fy1 = min(img_h, max(0, fy1))
                    
                    # YOLO bbox formatting
                    cx = ((fx0 + fx1) / 2) / img_w
                    cy = ((fy0 + fy1) / 2) / img_h
                    w = (fx1 - fx0) / img_w
                    h = (fy1 - fy0) / img_h
                    
                    # YOLO polygon / OBB (4 points)
                    poly = [
                        fx0 / img_w, fy0 / img_h,
                        fx1 / img_w, fy0 / img_h,
                        fx1 / img_w, fy1 / img_h,
                        fx0 / img_w, fy1 / img_h
                    ]
                    
                    text_dets.append({
                        "text": content,
                        "bbox_xyxy": [fx0, fy0, fx1, fy1],
                        "yolo_bbox": [cx, cy, w, h],
                        "yolo_polygon": poly
                    })
    except Exception as e:
        print(f"Error running PaddleOCR on {img_name}: {e}", file=sys.stderr)

    # Write output files
    shutil.copy2(img_path, img_out)
    
    # Save YOLO bounding box labels
    lbl_lines = [f"0 {d['yolo_bbox'][0]:.6f} {d['yolo_bbox'][1]:.6f} {d['yolo_bbox'][2]:.6f} {d['yolo_bbox'][3]:.6f}" for d in text_dets]
    lbl_out.write_text("\n".join(lbl_lines) + ("\n" if lbl_lines else ""))

    # Save YOLO segmentation labels
    seg_lines = [f"0 " + " ".join(f"{coord:.6f}" for coord in d['yolo_polygon']) for d in text_dets]
    seg_out.write_text("\n".join(seg_lines) + ("\n" if seg_lines else ""))

    # Save YOLO OBB labels
    obb_lines = [f"0 " + " ".join(f"{coord:.6f}" for coord in d['yolo_polygon']) for d in text_dets]
    obb_out.write_text("\n".join(obb_lines) + ("\n" if obb_lines else ""))

    # Save JSON annotations
    ann_out.write_text(json.dumps({
        "image": img_name,
        "image_width": img_w,
        "image_height": img_h,
        "class_name": "text",
        "class_id": 0,
        "detections": text_dets
    }, indent=2) + "\n")

    # Save visualization overlay image
    vis_img = image.copy()
    for d in text_dets:
        x0, y0, x1, y1 = map(int, d["bbox_xyxy"])
        cv2.rectangle(vis_img, (x0, y0), (x1, y1), (0, 255, 0), 2)
        txt = d["text"]
        (tw, th), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.rectangle(vis_img, (x0, max(0, y0 - th - 4)), (x0 + tw + 4, y0), (0, 255, 0), -1)
        cv2.putText(vis_img, txt, (x0 + 2, max(th + 2, y0 - 2)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA)
    cv2.imwrite(str(vis_out), vis_img)
    
    return len(text_dets)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=INPUT_DIR, help="Source images directory")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR, help="Output YOLO text dataset directory")
    parser.add_argument("--device", default="cuda", help="Inference device (cuda or cpu)")
    parser.add_argument("--no-layout-detection", action="store_true", help="Disable layout detection")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of frames to process")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    args = parser.parse_args()

    if not args.input_dir.is_dir():
        print(f"Input directory not found: {args.input_dir}", file=sys.stderr)
        return 1

    img_paths = sorted(
        p for p in args.input_dir.iterdir()
        if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png"}
    )
    if args.limit is not None:
        img_paths = img_paths[:args.limit]

    if not img_paths:
        print(f"No source images found in {args.input_dir}", file=sys.stderr)
        return 1

    # Ensure dataset directories (using a temporary path to build dataset atomically)
    temp_output_dir = args.output_dir.with_name(args.output_dir.name + "-temp")
    if temp_output_dir.exists():
        shutil.rmtree(temp_output_dir)

    out_dirs = {
        "images": temp_output_dir / "images",
        "annotated": temp_output_dir / "annotated",
        "labels": temp_output_dir / "labels",
        "labels_seg": temp_output_dir / "labels_seg",
        "labels_obb": temp_output_dir / "labels_obb",
        "annotations": temp_output_dir / "annotations",
    }
    for p in out_dirs.values():
        p.mkdir(parents=True, exist_ok=True)

    # Write data.yaml (pointing to the final final path)
    data_yaml = (
        f"path: {args.output_dir.resolve()}\n"
        "train: images\n"
        "val: images\n"
        "names:\n"
        "  0: text\n"
    )
    (temp_output_dir / "data.yaml").write_text(data_yaml)

    use_layout = not args.no_layout_detection
    print(f"Loading PaddleOCR-VL 1.6 model (layout_detection={use_layout})...")
    pipeline = PaddleOCRVL(
        pipeline_version="v1.6",
        engine="transformers",
        use_layout_detection=use_layout,
        device=args.device,
    )

    print(f"Processing {len(img_paths)} source images...")
    total_detections = 0
    for img_path in tqdm(img_paths, desc="OCR Frames"):
        dets = process_image(pipeline, img_path, out_dirs, use_layout, args.force)
        total_detections += dets

    print("Atomically moving dataset to final destination...")
    if args.output_dir.exists():
        shutil.rmtree(args.output_dir)
    
    ng_dir = args.output_dir.with_name(args.output_dir.name + "-NG")
    if ng_dir.exists():
        try:
            shutil.rmtree(ng_dir)
        except Exception:
            pass

    temp_output_dir.rename(args.output_dir)

    print(f"\nDone. Processed {len(img_paths)} frames, detected {total_detections} text block(s).")
    print(f"YOLO format text detection dataset output to: {args.output_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
