#!/usr/bin/env python3
"""End-to-end: extract frames from video, segment truck IDs with SAM3, run OCR."""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import cv2
from tqdm import tqdm

ROOT = Path(__file__).resolve().parent.parent
LABS_DIR = Path(__file__).resolve().parent
VIDEO_DIR = ROOT / "data" / "01-playlist"
DEFAULT_FRAMES_PER_VIDEO = 1024
VIDEO_EXTENSIONS = {".webm", ".mkv", ".mp4", ".avi", ".mov"}
FRAME_NAME_RE = re.compile(r"_frame(\d+)$")

OCR_BACKENDS = {
    "paddle-ocr-vl-1.6": {
        "lab_file": "04-ocr-truck-id-using-paddle-ocr-vl-1.6.py",
        "slug": "extract-video-using-sam3-and-ocr-using-paddle-ocr-vl-1.6",
    },
    "nvidia-nemotron-ocr-v2": {
        "lab_file": "05-ocr-truck-id-using-nvidia-nemotron-ocr-2.py",
        "slug": "extract-video-using-sam3-and-ocr-using-nvidia-nemotron-ocr-v2",
    },
}


def import_lab_module(filename: str):
    path = LABS_DIR / filename
    module_name = path.stem.replace("-", "_")
    if module_name in sys.modules:
        return sys.modules[module_name]
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load lab module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def output_dir_for_backend(ocr_backend: str) -> Path:
    slug = OCR_BACKENDS[ocr_backend]["slug"]
    return ROOT / "data" / f"06-{slug}"


def list_videos(video_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in video_dir.iterdir()
        if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS
    )


def select_videos(
    video_dir: Path,
    video_id: str | None,
    limit_videos: int | None,
) -> list[Path]:
    videos = list_videos(video_dir)
    if not videos:
        return []

    if video_id is not None:
        matches = [path for path in videos if path.stem == video_id]
        if not matches:
            available = ", ".join(path.stem for path in videos[:5])
            raise ValueError(f"Video id {video_id!r} not found. Examples: {available}")
        videos = matches

    if limit_videos is not None:
        videos = videos[:limit_videos]
    return videos


def get_duration(video_path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(result.stdout.strip())


def get_frame_rate(video_path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=r_frame_rate",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    rate = result.stdout.strip()
    if "/" in rate:
        num, den = rate.split("/", maxsplit=1)
        return float(num) / float(den)
    return float(rate)


def frame_number(path: Path) -> int:
    match = FRAME_NAME_RE.search(path.stem)
    return int(match.group(1)) if match else 0


def frame_path_pattern(frames_dir: Path, stem: str, width: int) -> str:
    return str(frames_dir / f"{stem}_frame%0{width}d.jpg")


def list_extracted_frames(frames_dir: Path, stem: str) -> list[Path]:
    return sorted(frames_dir.glob(f"{stem}_frame*.jpg"), key=frame_number)


def extract_all_frames_for_video(
    video_path: Path,
    frames_dir: Path,
    force: bool,
) -> list[Path]:
    frames_dir.mkdir(parents=True, exist_ok=True)
    stem = video_path.stem
    existing = list_extracted_frames(frames_dir, stem)
    if existing and not force:
        return existing

    pattern = frame_path_pattern(frames_dir, stem, 6)
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(video_path),
            "-q:v",
            "2",
            "-vsync",
            "0",
            "-y",
            pattern,
        ],
        check=True,
    )
    return list_extracted_frames(frames_dir, stem)


def extract_sampled_frames_for_video(
    video_path: Path,
    frames_dir: Path,
    frames_per_video: int,
    force: bool,
) -> list[Path]:
    """Extract evenly spaced frames in one ffmpeg pass (fast-forward sampling)."""
    frames_dir.mkdir(parents=True, exist_ok=True)
    stem = video_path.stem
    existing = list_extracted_frames(frames_dir, stem)
    if existing and not force and len(existing) >= frames_per_video:
        return existing[:frames_per_video]

    duration = get_duration(video_path)
    pattern = frame_path_pattern(frames_dir, stem, 6)
    sample_fps = frames_per_video / duration if duration > 0 else 1.0

    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(video_path),
            "-vf",
            f"fps={sample_fps:.8f}",
            "-frames:v",
            str(frames_per_video),
            "-q:v",
            "2",
            "-y",
            pattern,
        ],
        check=True,
    )
    return list_extracted_frames(frames_dir, stem)[:frames_per_video]


def extract_frames_for_video(
    video_path: Path,
    frames_dir: Path,
    frames_per_video: int | None,
    force: bool,
) -> list[Path]:
    if frames_per_video is None:
        return extract_all_frames_for_video(video_path, frames_dir, force)
    return extract_sampled_frames_for_video(
        video_path,
        frames_dir,
        frames_per_video,
        force,
    )


def overlay_ocr_labels(
    annotated_image_path: Path,
    ocr_result_path: Path,
    output_path: Path,
) -> None:
    image = cv2.imread(str(annotated_image_path))
    if image is None:
        raise ValueError(f"Could not read image: {annotated_image_path}")

    ocr_result = json.loads(ocr_result_path.read_text())
    for det in ocr_result.get("detections", []):
        bbox = det.get("bbox_xyxy")
        if not bbox:
            continue
        text = (det.get("text") or "").strip() or "?"
        score = det.get("score")
        x0, y0, x1, y1 = map(int, bbox)
        label = f"{text}" if score is None else f"{text} ({score:.2f})"
        cv2.rectangle(image, (x0, y0), (x1, y1), (0, 255, 0), 2)
        cv2.putText(
            image,
            label,
            (x0, max(y0 - 10, 20)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 0),
            2,
            cv2.LINE_AA,
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output_path), image)


def render_output_frames(
    frame_paths: list[Path],
    sam3_annotated_dir: Path,
    ocr_results_dir: Path,
    output_frames_dir: Path,
    force: bool,
) -> list[Path]:
    output_frames_dir.mkdir(parents=True, exist_ok=True)
    rendered: list[Path] = []

    for frame_path in frame_paths:
        stem = frame_path.stem
        annotated_path = sam3_annotated_dir / frame_path.name
        ocr_result_path = ocr_results_dir / f"{stem}.json"
        output_path = output_frames_dir / frame_path.name

        if output_path.exists() and not force:
            rendered.append(output_path)
            continue

        if not annotated_path.exists():
            raise FileNotFoundError(f"Missing SAM3 annotated frame: {annotated_path}")
        if not ocr_result_path.exists():
            raise FileNotFoundError(f"Missing OCR result: {ocr_result_path}")

        overlay_ocr_labels(annotated_path, ocr_result_path, output_path)
        rendered.append(output_path)

    return rendered


def assemble_output_video(
    frame_paths: list[Path],
    output_video: Path,
    frame_rate: float,
    force: bool,
) -> Path:
    if output_video.exists() and not force:
        return output_video

    if not frame_paths:
        raise ValueError("No frames available for output video")

    first_frame = frame_paths[0]
    stem = first_frame.stem.rsplit("_frame", maxsplit=1)[0]
    width = max(len(str(frame_number(path))) for path in frame_paths)
    width = max(width, 6)
    pattern = frame_path_pattern(first_frame.parent, stem, width)

    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-framerate",
            f"{frame_rate:.6f}",
            "-start_number",
            str(frame_number(first_frame)),
            "-i",
            pattern,
            "-frames:v",
            str(len(frame_paths)),
            "-pix_fmt",
            "yuv420p",
            "-y",
            str(output_video),
        ],
        check=True,
    )
    return output_video


def run_ocr_for_video(
    ocr_mod,
    ocr_backend: str,
    pipeline,
    annotation_paths: list[Path],
    frames_dir: Path,
    ocr_dirs: dict[str, Path],
    padding_ratio: float,
    nemotron_merge_level: str,
    force: bool,
) -> tuple[dict, float, list[dict]]:
    ocr_processed = 0
    total_ocr = 0
    ocr_elapsed_seconds = 0.0
    all_extractions: list[dict] = []

    for annotation_path in annotation_paths:
        if ocr_backend == "paddle-ocr-vl-1.6":
            frame_processed, frame_ocr, frame_elapsed, extractions = ocr_mod.process_annotation(
                pipeline,
                annotation_path,
                frames_dir,
                ocr_dirs,
                padding_ratio,
                force,
            )
        else:
            frame_processed, frame_ocr, frame_elapsed, extractions = ocr_mod.process_annotation(
                pipeline,
                annotation_path,
                frames_dir,
                ocr_dirs,
                padding_ratio,
                nemotron_merge_level,
                force,
            )
        ocr_processed += frame_processed
        total_ocr += frame_ocr
        ocr_elapsed_seconds += frame_elapsed
        all_extractions.extend(extractions)

    if ocr_backend == "paddle-ocr-vl-1.6":
        ocr_metadata = {
            "ocr_backend": ocr_backend,
            "pipeline_version": ocr_mod.PIPELINE_VERSION,
            "processed_frames": ocr_processed,
            "total_ocr_calls": total_ocr,
        }
    else:
        ocr_metadata = {
            "ocr_backend": ocr_backend,
            "model": ocr_mod.MODEL_ID,
            "processed_frames": ocr_processed,
            "total_ocr_calls": total_ocr,
        }

    return ocr_metadata, ocr_elapsed_seconds, all_extractions


def process_video(
    video_path: Path,
    output_dir: Path,
    sam3_mod,
    ocr_mod,
    processor,
    pipeline,
    ocr_backend: str,
    text_prompt: str,
    padding_ratio: float,
    nemotron_merge_level: str,
    frames_per_video: int | None,
    write_video: bool,
    force: bool,
) -> dict:
    video_id = video_path.stem
    video_output = output_dir / video_id
    frames_dir = video_output / "frames"
    sam3_dir = video_output / "sam3"
    ocr_dir = video_output / "ocr"
    output_frames_dir = video_output / "output_frames"
    output_video_path = video_output / f"{video_id}_annotated.mp4"

    frame_rate = get_frame_rate(video_path)
    frame_paths = extract_frames_for_video(
        video_path,
        frames_dir,
        frames_per_video,
        force,
    )
    print(f"Extracted {len(frame_paths)} frame(s) from {video_path.name}")

    sam3_dirs = sam3_mod.ensure_dataset_layout(sam3_dir)
    sam3_mod.write_data_yaml(sam3_dir)

    sam3_processed = 0
    total_detections = 0
    for image_path in tqdm(frame_paths, desc=f"{video_id} SAM3", unit="frame"):
        frame_processed, frame_detections = sam3_mod.process_frame(
            processor,
            image_path,
            sam3_dirs,
            text_prompt,
            force,
        )
        sam3_processed += frame_processed
        total_detections += frame_detections

    annotation_paths = sorted(sam3_dirs["annotations"].glob("*.json"))
    ocr_dirs = ocr_mod.ensure_output_layout(ocr_dir)
    ocr_metadata, ocr_elapsed_seconds, all_extractions = run_ocr_for_video(
        ocr_mod,
        ocr_backend,
        pipeline,
        annotation_paths,
        frames_dir,
        ocr_dirs,
        padding_ratio,
        nemotron_merge_level,
        force,
    )

    output_video: str | None = None
    if write_video:
        rendered_frames = render_output_frames(
            frame_paths,
            sam3_dirs["annotated"],
            ocr_dirs["results"],
            output_frames_dir,
            force,
        )
        assemble_output_video(
            rendered_frames,
            output_video_path,
            frame_rate,
            force,
        )
        output_video = str(output_video_path)

    return {
        "video_id": video_id,
        "video_file": video_path.name,
        "frames": len(frame_paths),
        "sam3_processed_frames": sam3_processed,
        "sam3_detections": total_detections,
        "ocr_metadata": ocr_metadata,
        "ocr_elapsed_seconds": round(ocr_elapsed_seconds, 4),
        "output_video": output_video,
        "extractions": all_extractions,
        "output_dir": str(video_output),
    }


def build_ocr_pipeline(
    ocr_mod,
    ocr_backend: str,
    paddle_engine: str,
    paddle_device: str | None,
    nemotron_lang: str,
    nemotron_model_dir: Path | None,
    nemotron_use_relational: bool,
):
    if ocr_backend == "paddle-ocr-vl-1.6":
        print(
            f"Loading PaddleOCR-VL v1.6 "
            f"(engine={paddle_engine!r}, device={paddle_device!r})..."
        )
        return ocr_mod.build_pipeline(paddle_engine, paddle_device)

    print(
        f"Loading Nemotron OCR v2 "
        f"(lang={nemotron_lang!r})..."
    )
    return ocr_mod.build_pipeline(
        nemotron_lang,
        nemotron_model_dir,
        skip_relational=not nemotron_use_relational,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--ocr-backend",
        choices=sorted(OCR_BACKENDS),
        default="paddle-ocr-vl-1.6",
        help="OCR engine for truck ID text extraction",
    )
    parser.add_argument(
        "--video-dir",
        type=Path,
        default=VIDEO_DIR,
        help="Directory of source videos",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Override output directory (default: data/06-<slug>/)",
    )
    parser.add_argument(
        "--video-id",
        default=None,
        help="Process a single video by id (stem of filename)",
    )
    parser.add_argument(
        "--limit-videos",
        type=int,
        default=None,
        help="Process only the first N videos (default: all)",
    )
    parser.add_argument(
        "--frames-per-video",
        type=int,
        default=DEFAULT_FRAMES_PER_VIDEO,
        help=(
            f"Extract N evenly spaced frames via fast-forward sampling "
            f"(default: {DEFAULT_FRAMES_PER_VIDEO})"
        ),
    )
    parser.add_argument(
        "--all-frames",
        action="store_true",
        help="Extract every frame from each video (overrides --frames-per-video)",
    )
    parser.add_argument(
        "--text-prompt",
        default="truck number",
        help="SAM3 text prompt for truck ID segmentation",
    )
    parser.add_argument(
        "--confidence-threshold",
        type=float,
        default=0.5,
        help="Minimum SAM3 detection confidence",
    )
    parser.add_argument(
        "--padding-ratio",
        type=float,
        default=0.1,
        help="Padding around each detection bbox before OCR",
    )
    parser.add_argument(
        "--paddle-engine",
        default="transformers",
        choices=["transformers", "paddle", "paddle_dynamic", "paddle_static"],
        help="PaddleOCR-VL inference engine",
    )
    parser.add_argument(
        "--paddle-device",
        default=None,
        help="PaddleOCR-VL device override (e.g. cuda, cpu)",
    )
    parser.add_argument(
        "--nemotron-lang",
        default="en",
        choices=["en", "multi"],
        help="Nemotron OCR v2 language variant",
    )
    parser.add_argument(
        "--nemotron-model-dir",
        type=Path,
        default=None,
        help="Local Nemotron checkpoint directory (overrides --nemotron-lang)",
    )
    parser.add_argument(
        "--nemotron-merge-level",
        default="word",
        choices=["word", "sentence", "paragraph"],
        help="Nemotron OCR merge level",
    )
    parser.add_argument(
        "--nemotron-use-relational",
        action="store_true",
        help="Enable Nemotron relational model for reading-order grouping",
    )
    parser.add_argument(
        "--no-output-video",
        action="store_true",
        help="Skip annotated output video generation",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reprocess frames, SAM3 labels, OCR results, and output video",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.ocr_backend == "nvidia-nemotron-ocr-v2":
        nemotron_mod = import_lab_module(OCR_BACKENDS["nvidia-nemotron-ocr-v2"]["lab_file"])
        if not os.environ.get("NEMOTRON_OCR_SUBPROCESS"):
            nemotron_mod.ensure_nemotron_python()

    if not args.video_dir.is_dir():
        print(f"Video directory not found: {args.video_dir}", file=sys.stderr)
        return 1

    try:
        videos = select_videos(args.video_dir, args.video_id, args.limit_videos)
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 1

    if not videos:
        print(f"No videos found in {args.video_dir}", file=sys.stderr)
        return 1

    output_dir = args.output_dir or output_dir_for_backend(args.ocr_backend)
    output_dir.mkdir(parents=True, exist_ok=True)

    sam3_mod = import_lab_module("03-extract-truck-id.py")
    ocr_mod = import_lab_module(OCR_BACKENDS[args.ocr_backend]["lab_file"])

    print(f"Loading SAM3 (prompt={args.text_prompt!r})...")
    processor = sam3_mod.build_processor(args.confidence_threshold)
    pipeline = build_ocr_pipeline(
        ocr_mod,
        args.ocr_backend,
        args.paddle_engine,
        args.paddle_device,
        args.nemotron_lang,
        args.nemotron_model_dir,
        args.nemotron_use_relational,
    )

    run_start = time.perf_counter()
    video_summaries: list[dict] = []
    all_extractions: list[dict] = []
    total_ocr_elapsed = 0.0
    write_video = not args.no_output_video
    frames_per_video = None if args.all_frames else args.frames_per_video

    for video_path in videos:
        print(f"\n=== {video_path.name} ===")
        summary = process_video(
            video_path,
            output_dir,
            sam3_mod,
            ocr_mod,
            processor,
            pipeline,
            args.ocr_backend,
            args.text_prompt,
            args.padding_ratio,
            args.nemotron_merge_level,
            frames_per_video,
            write_video,
            args.force,
        )
        video_summaries.append(summary)
        all_extractions.extend(summary["extractions"])
        total_ocr_elapsed += summary["ocr_elapsed_seconds"]
        video_note = f", video={summary['output_video']}" if summary["output_video"] else ""
        tqdm.write(
            f"{summary['video_id']}: {summary['sam3_detections']} SAM3 detection(s), "
            f"{summary['ocr_metadata']['total_ocr_calls']} OCR result(s){video_note}"
        )

    run_elapsed_seconds = time.perf_counter() - run_start
    run_summary = {
        "ocr_backend": args.ocr_backend,
        "videos_processed": len(video_summaries),
        "run_elapsed_seconds": round(run_elapsed_seconds, 4),
        "ocr_elapsed_seconds": round(total_ocr_elapsed, 4),
        "total_extractions": len(all_extractions),
        "videos": video_summaries,
        "extractions": all_extractions,
    }
    (output_dir / "summary.json").write_text(json.dumps(run_summary, indent=2) + "\n")

    lines = []
    for item in all_extractions:
        text = item["text"] or "(no text)"
        lines.append(
            f"{item['frame']} det{item['detection_index']:02d}: "
            f"{text} ({item['elapsed_seconds']:.4f}s)"
        )
    (output_dir / "extracted-texts.txt").write_text("\n".join(lines) + ("\n" if lines else ""))

    print(
        f"\nDone. Processed {len(video_summaries)} video(s), "
        f"{len(all_extractions)} OCR extraction(s). "
        f"OCR time: {total_ocr_elapsed:.2f}s, run time: {run_elapsed_seconds:.2f}s. "
        f"Output: {output_dir}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
