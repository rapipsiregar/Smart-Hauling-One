#!/usr/bin/env python3
"""Extract truck ID text from SAM3 detections using NVIDIA Nemotron OCR v2."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np
from tqdm import tqdm

ROOT = Path(__file__).resolve().parent.parent
NEMOTRON_VENV_PYTHON = ROOT / ".venv-nemotron" / "bin" / "python"
INPUT_DIR = ROOT / "data" / "02-extracted-images-from-videos"
ANNOTATION_DIR = ROOT / "data" / "03-extract-truck-id" / "annotations"
OUTPUT_DIR = ROOT / "data" / "05-ocr-truck-id-using-nvidia-nemotron-ocr-2"
MODEL_ID = "nvidia/nemotron-ocr-v2"
FRAME_NAME_RE = re.compile(r"^(.+)_frame\d+$")


def ensure_nemotron_python() -> None:
    if NEMOTRON_VENV_PYTHON.exists() and Path(sys.executable).resolve() != NEMOTRON_VENV_PYTHON.resolve():
        os.execv(str(NEMOTRON_VENV_PYTHON), [str(NEMOTRON_VENV_PYTHON), *sys.argv])
    try:
        from nemotron_ocr.inference.pipeline_v2 import NemotronOCRV2  # noqa: F401
    except ImportError as exc:
        raise SystemExit(
            "Nemotron OCR is not installed. Create the env and install the package:\n"
            "  uv venv .venv-nemotron --python 3.12\n"
            "  uv pip install --python .venv-nemotron/bin/python torch torchvision "
            "--index-url https://download.pytorch.org/whl/cu126\n"
            "  uv pip install --python .venv-nemotron/bin/python hatchling editables setuptools ninja\n"
            "  CUDA_HOME=/usr/local/cuda-12.6 uv pip install --python .venv-nemotron/bin/python "
            "--no-build-isolation ./nemotron-ocr-v2/nemotron-ocr\n"
            f"\nOriginal error: {exc}"
        ) from exc


def video_id_from_frame(path: Path) -> str:
    match = FRAME_NAME_RE.match(path.stem)
    return match.group(1) if match else path.stem


def group_annotations_by_video(annotation_paths: list[Path]) -> list[tuple[str, list[Path]]]:
    groups: dict[str, list[Path]] = defaultdict(list)
    for path in annotation_paths:
        groups[video_id_from_frame(path)].append(path)
    return [(video_id, sorted(paths)) for video_id, paths in sorted(groups.items())]


def ensure_output_layout(output_dir: Path) -> dict[str, Path]:
    dirs = {
        "crops": output_dir / "crops",
        "results": output_dir / "results",
    }
    for path in dirs.values():
        path.mkdir(parents=True, exist_ok=True)
    return dirs


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


def extract_text_from_predictions(predictions: list[dict]) -> str:
    texts = [pred["text"].strip() for pred in predictions if pred.get("text")]
    return " ".join(texts).strip()


def prediction_to_dict(pred: dict) -> dict:
    return {
        "text": pred.get("text"),
        "confidence": float(pred["confidence"]) if pred.get("confidence") is not None else None,
        "left": float(pred["left"]) if pred.get("left") is not None else None,
        "upper": float(pred["upper"]) if pred.get("upper") is not None else None,
        "right": float(pred["right"]) if pred.get("right") is not None else None,
        "lower": float(pred["lower"]) if pred.get("lower") is not None else None,
        "quad": pred.get("quad"),
    }


def build_pipeline(lang: str, model_dir: Path | None, skip_relational: bool):
    from nemotron_ocr.inference.pipeline_v2 import NemotronOCRV2

    kwargs: dict = {
        "skip_relational": skip_relational,
    }
    if model_dir is not None:
        kwargs["model_dir"] = str(model_dir)
    else:
        kwargs["lang"] = lang
    return NemotronOCRV2(**kwargs)


def run_ocr(pipeline, crop_path: Path, merge_level: str) -> tuple[list[dict], float]:
    start = time.perf_counter()
    predictions = pipeline(str(crop_path), merge_level=merge_level)
    elapsed = time.perf_counter() - start
    return [prediction_to_dict(pred) for pred in predictions], elapsed


def extraction_record(
    annotation_path: Path,
    image_name: str,
    det_index: int,
    text: str,
    elapsed_seconds: float,
) -> dict:
    return {
        "frame": annotation_path.stem,
        "image": image_name,
        "detection_index": det_index,
        "text": text,
        "elapsed_seconds": round(elapsed_seconds, 4),
    }


def write_run_summary(
    output_dir: Path,
    metadata: dict,
    extractions: list[dict],
    run_elapsed_seconds: float,
    ocr_elapsed_seconds: float,
) -> None:
    summary = {
        **metadata,
        "run_elapsed_seconds": round(run_elapsed_seconds, 4),
        "ocr_elapsed_seconds": round(ocr_elapsed_seconds, 4),
        "total_extractions": len(extractions),
        "extractions": extractions,
    }
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")

    lines = []
    for item in extractions:
        text = item["text"] or "(no text)"
        lines.append(
            f"{item['frame']} det{item['detection_index']:02d}: "
            f"{text} ({item['elapsed_seconds']:.4f}s)"
        )
    (output_dir / "extracted-texts.txt").write_text("\n".join(lines) + ("\n" if lines else ""))


def process_annotation(
    pipeline,
    annotation_path: Path,
    input_dir: Path,
    dirs: dict[str, Path],
    padding_ratio: float,
    merge_level: str,
    force: bool,
) -> tuple[int, int, float, list[dict]]:
    annotation = json.loads(annotation_path.read_text())
    image_name = annotation["image"]
    result_path = dirs["results"] / f"{annotation_path.stem}.json"

    if not force and result_path.exists():
        existing = json.loads(result_path.read_text())
        extractions = [
            extraction_record(
                annotation_path,
                image_name,
                det["detection_index"],
                det.get("text", ""),
                det.get("elapsed_seconds", 0.0),
            )
            for det in existing.get("detections", [])
        ]
        for record in extractions:
            display_text = record["text"] or "(no text)"
            tqdm.write(
                f"  {record['frame']} det{record['detection_index']:02d}: "
                f"{display_text} ({record['elapsed_seconds']:.4f}s) [cached]"
            )
        return 0, len(extractions), existing.get("elapsed_seconds", 0.0), extractions

    image_path = input_dir / image_name
    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError(f"Could not read image: {image_path}")

    frame_start = time.perf_counter()
    ocr_results: list[dict] = []
    extractions: list[dict] = []
    for det_index, detection in enumerate(annotation.get("detections", [])):
        crop_name = f"{annotation_path.stem}_det{det_index:02d}.jpg"
        crop_path = dirs["crops"] / crop_name
        crop, crop_bbox = crop_detection(image, detection["bbox_xyxy"], padding_ratio)

        if crop.size == 0:
            continue

        if force or not crop_path.exists():
            cv2.imwrite(str(crop_path), crop)

        predictions, ocr_elapsed = run_ocr(pipeline, crop_path, merge_level)
        text = extract_text_from_predictions(predictions)
        ocr_results.append(
            {
                "detection_index": det_index,
                "score": detection.get("score"),
                "bbox_xyxy": detection.get("bbox_xyxy"),
                "crop_bbox_xyxy": crop_bbox,
                "crop_image": crop_name,
                "text": text,
                "elapsed_seconds": round(ocr_elapsed, 4),
                "ocr": predictions,
            }
        )
        record = extraction_record(annotation_path, image_name, det_index, text, ocr_elapsed)
        extractions.append(record)
        display_text = text or "(no text)"
        tqdm.write(
            f"  {annotation_path.stem} det{det_index:02d}: "
            f"{display_text} ({ocr_elapsed:.4f}s)"
        )

    frame_elapsed = time.perf_counter() - frame_start
    result_path.write_text(
        json.dumps(
            {
                "image": image_name,
                "video_id": video_id_from_frame(annotation_path),
                "image_width": annotation.get("image_width"),
                "image_height": annotation.get("image_height"),
                "model": MODEL_ID,
                "elapsed_seconds": round(frame_elapsed, 4),
                "detections": ocr_results,
            },
            indent=2,
        )
        + "\n"
    )
    return 1, len(ocr_results), frame_elapsed, extractions


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=INPUT_DIR,
        help="Directory of extracted frame images",
    )
    parser.add_argument(
        "--annotation-dir",
        type=Path,
        default=ANNOTATION_DIR,
        help="Directory of SAM3 annotation JSON files",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=OUTPUT_DIR,
        help="Directory for OCR crops and results",
    )
    parser.add_argument(
        "--lang",
        default="en",
        choices=["en", "multi"],
        help="Nemotron OCR v2 variant (en recommended for truck numbers)",
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=None,
        help="Local Nemotron checkpoint directory (overrides --lang)",
    )
    parser.add_argument(
        "--merge-level",
        default="word",
        choices=["word", "sentence", "paragraph"],
        help="Nemotron OCR merge level for grouped text output",
    )
    parser.add_argument(
        "--use-relational",
        action="store_true",
        help="Enable relational model for reading-order grouping (default: off)",
    )
    parser.add_argument(
        "--padding-ratio",
        type=float,
        default=0.1,
        help="Padding around each detection bbox before OCR",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process only the first N annotation files (for testing)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reprocess frames even if OCR results already exist",
    )
    return parser.parse_args()


def main() -> int:
    ensure_nemotron_python()
    args = parse_args()
    skip_relational = not args.use_relational

    if not args.input_dir.is_dir():
        print(f"Input directory not found: {args.input_dir}", file=sys.stderr)
        return 1
    if not args.annotation_dir.is_dir():
        print(f"Annotation directory not found: {args.annotation_dir}", file=sys.stderr)
        return 1

    annotation_paths = sorted(args.annotation_dir.glob("*.json"))
    if args.limit is not None:
        annotation_paths = annotation_paths[: args.limit]
    if not annotation_paths:
        print(f"No annotation JSON files found in {args.annotation_dir}", file=sys.stderr)
        return 1

    video_groups = group_annotations_by_video(annotation_paths)
    dirs = ensure_output_layout(args.output_dir)

    print(
        f"Loading Nemotron OCR v2 ({MODEL_ID}, lang={args.lang!r}, "
        f"merge_level={args.merge_level!r})..."
    )
    pipeline = build_pipeline(args.lang, args.model_dir, skip_relational)

    run_start = time.perf_counter()
    processed = 0
    total_ocr = 0
    ocr_elapsed_seconds = 0.0
    all_extractions: list[dict] = []
    for video_id, video_annotations in tqdm(video_groups, desc="Videos", unit="video"):
        video_ocr = 0
        for annotation_path in tqdm(
            video_annotations,
            desc=video_id,
            leave=False,
            unit="frame",
        ):
            frame_processed, frame_ocr, frame_elapsed, extractions = process_annotation(
                pipeline,
                annotation_path,
                args.input_dir,
                dirs,
                args.padding_ratio,
                args.merge_level,
                args.force,
            )
            processed += frame_processed
            video_ocr += frame_ocr
            total_ocr += frame_ocr
            ocr_elapsed_seconds += frame_elapsed
            all_extractions.extend(extractions)

        tqdm.write(
            f"{video_id}: {video_ocr} OCR result(s) across {len(video_annotations)} frame(s)"
        )

    run_elapsed_seconds = time.perf_counter() - run_start
    write_run_summary(
        args.output_dir,
        {
            "model": MODEL_ID,
            "lang": args.lang,
            "merge_level": args.merge_level,
            "processed_frames": processed,
            "total_ocr_calls": total_ocr,
        },
        all_extractions,
        run_elapsed_seconds,
        ocr_elapsed_seconds,
    )

    print(
        f"Done. Processed {processed} new frame(s) across {len(video_groups)} video(s), "
        f"{total_ocr} OCR result(s) total. "
        f"OCR time: {ocr_elapsed_seconds:.2f}s, run time: {run_elapsed_seconds:.2f}s. "
        f"Output: {args.output_dir}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
