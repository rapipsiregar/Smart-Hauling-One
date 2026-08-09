#!/usr/bin/env python3
"""Run custom trained YOLO model on videos to detect truck IDs and extract text via OCR.

Thin CLI entry point. Detection/OCR/voting logic lives in the ``custom_model`` package:
  - custom_model/ocr_utils.py       OCR extraction, crop padding, normalize, fuzzy vote
  - custom_model/video_processor.py batched per-video inference

Outputs a simple JSON file with the voted hull ID per video.
"""

from __future__ import annotations

import argparse
import gc
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from tqdm import tqdm

# Allow "from custom_model import ..." when run directly.
sys.path.append(str(Path(__file__).resolve().parent))
from custom_model.video_processor import process_video
from custom_model.visualizer import create_annotated_video

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT_DIR = ROOT / "data" / "01b-videos-converted-to-mp4"
DEFAULT_MODEL = ROOT / "ai-model" / "pak-shomad-v2.pt"
VIDEO_EXTENSIONS = {".webm", ".mkv", ".mp4", ".avi", ".mov"}


def cleanup_stale_gpu_processes() -> None:
    """Kill stale background Python processes occupying GPU VRAM prior to inference."""
    current_pid = os.getpid()
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-compute-apps=pid,process_name", "--format=csv,noheader,nounits"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        for line in out.strip().splitlines():
            if not line:
                continue
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 2:
                pid_str, proc_name = parts[0], parts[1]
                if pid_str.isdigit():
                    pid = int(pid_str)
                    if pid != current_pid and "python" in proc_name.lower():
                        print(f"Clearing stale GPU process (PID {pid})...")
                        if sys.platform == "win32":
                            subprocess.run(
                                ["powershell", "-Command", f"Stop-Process -Id {pid} -Force"],
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL,
                                check=False,
                            )
                        else:
                            os.kill(pid, 9)
    except Exception:
        pass

    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
    except Exception:
        pass


def build_ocr_pipeline(device: str | None):
    """Build a PaddleOCR-VL pipeline for text extraction."""
    from paddleocr import PaddleOCRVL
    kwargs = {
        "pipeline_version": "v1.6",
        "engine": "transformers",
        "use_layout_detection": False,
    }
    if device:
        # PaddleOCRVL expects 'gpu'/'cpu'; map torch-style 'cuda'.
        dev = device.strip().lower()
        if dev.startswith("cuda"):
            dev = "gpu" if ":" not in dev else "gpu:" + dev.split(":", 1)[1]
        kwargs["device"] = dev
    return PaddleOCRVL(**kwargs)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT_DIR, help="Input video directory")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL, help="Path to trained YOLO model")
    parser.add_argument("--output", type=Path, default=None, help="Output JSON file path")
    parser.add_argument("--confidence", type=float, default=0.25, help="Detection confidence threshold")
    parser.add_argument("--max-frames", type=int, default=None, help="Max frames per video")
    parser.add_argument("--batch-size", type=int, default=4, help="Frames per batched YOLO inference call")
    parser.add_argument("--frame-stride", type=int, default=5, help="Process every Nth frame only (speed & heat protection)")
    parser.add_argument("--ocr-min-conf", type=float, default=0.30, help="Skip OCR below this detection confidence (#3)")
    parser.add_argument("--ocr-min-area", type=int, default=400, help="Skip OCR on bboxes smaller than this area px^2 (#3)")
    parser.add_argument("--dedup-iou", type=float, default=0.92, help="Skip OCR when bbox ~matches previous OCR'd box (#3)")
    parser.add_argument("--video-id", default=None, help="Process single video by stem name")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of videos")
    parser.add_argument("--device", default=None, help="Device for inference (cuda, cpu, etc.)")
    parser.add_argument("--skip-ocr", action="store_true", help="Skip OCR step, only detect")
    parser.add_argument("--save-video", action="store_true", help="Render and save annotated video files")
    return parser.parse_args()


def resolve_videos(args: argparse.Namespace) -> tuple[Path, list[Path]] | None:
    """Resolve input dir (with fallback) and the filtered video list."""
    input_dir = args.input
    has_video = input_dir.is_dir() and any(
        p.suffix.lower() in VIDEO_EXTENSIONS for p in input_dir.iterdir()
    )
    if not has_video:
        alt = ROOT / "data" / "01-playlist"
        if alt.is_dir() and any(p.suffix.lower() in VIDEO_EXTENSIONS for p in alt.iterdir()):
            print(f"Input directory {input_dir} empty/missing. Falling back to: {alt}")
            input_dir = alt
        else:
            print(f"Input directory not found or empty: {input_dir}", file=sys.stderr)
            return None

    videos = sorted(
        p for p in input_dir.iterdir()
        if p.is_file() and p.suffix.lower() in VIDEO_EXTENSIONS
    )
    if args.video_id:
        videos = [p for p in videos if p.stem == args.video_id]
    if args.limit:
        videos = videos[:args.limit]
    return input_dir, videos


def main() -> int:
    cleanup_stale_gpu_processes()
    args = parse_args()

    if not args.model.exists():
        print(f"Model not found: {args.model}", file=sys.stderr)
        return 1

    resolved = resolve_videos(args)
    if resolved is None:
        return 1
    input_dir, videos = resolved
    if not videos:
        print(f"No videos found in {args.input}", file=sys.stderr)
        return 1

    from ultralytics import YOLO
    print(f"Loading model: {args.model}")
    model = YOLO(str(args.model))

    ocr_pipeline = None
    if not args.skip_ocr:
        print("Loading OCR pipeline...")
        try:
            ocr_pipeline = build_ocr_pipeline(args.device)
        except Exception as e:
            print(f"Warning: Could not load OCR pipeline: {e}", file=sys.stderr)
            print("Continuing without OCR...")
            args.skip_ocr = True

    results = []
    start_time = time.time()
    for video_path in tqdm(videos, desc="Videos", unit="video"):
        result = process_video(
            model=model,
            video_path=video_path,
            conf_threshold=args.confidence,
            max_frames=args.max_frames,
            ocr_pipeline=ocr_pipeline,
            skip_ocr=args.skip_ocr,
            batch_size=args.batch_size,
            frame_stride=args.frame_stride,
            ocr_min_conf=args.ocr_min_conf,
            ocr_min_area=args.ocr_min_area,
            dedup_iou=args.dedup_iou,
        )
        results.append(result)
        
        # Save annotated video if requested
        if getattr(args, "save_video", False):
            tqdm.write(f"Rendering annotated video: {video_path.name}...")
            out_file = create_annotated_video(
                video_path=video_path,
                detections=result["detections"],
                voted_id=result["voted_hull_id"],
                vote_conf=result.get("vote_confidence", 0.0),
                frame_stride=args.frame_stride,
            )
            if out_file:
                tqdm.write(f"Saved: {out_file.name}")
                
        tqdm.write(f"{video_path.name}: {result['voted_hull_id']} ({result['total_detections']} detections)")

    elapsed = time.time() - start_time

    output = {
        "run_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "model": str(args.model.name),
        "input_directory": str(input_dir),
        "videos_processed": len(videos),
        "total_elapsed_seconds": round(elapsed, 2),
        "results": results,
    }

    output_path = args.output or (ROOT / "data" / "12-run-custom-model-results.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2))
    print(f"\nResults saved to: {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
