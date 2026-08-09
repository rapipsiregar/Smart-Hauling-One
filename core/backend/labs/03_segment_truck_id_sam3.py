#!/usr/bin/env python3
"""Segment truck ID regions in extracted frames/videos using SAM3 and export YOLO labels."""

from __future__ import annotations

import argparse
import shutil
import sys
from collections import defaultdict
from pathlib import Path
from tqdm import tqdm

# Ensure parent directory/current directory is in path for dynamic imports to resolve
sys.path.append(str(Path(__file__).resolve().parent))

# Import for backward compatibility and internal use
from yolo_utils import (
    CLASS_ID,
    CLASS_NAME,
    xyxy_to_yolo_bbox,
    mask_to_yolo_polygon,
    write_yolo_bbox_label,
    write_yolo_seg_label,
    yolo_polygon_to_points,
    yolo_polygon_to_mask,
    detections_to_supervision,
    save_annotated_image,
    ensure_dataset_layout,
    write_data_yaml,
)
from sam3_inference import build_processor, detect_truck_ids, process_frame
from video_extraction import extract_frames_from_video

ROOT = Path(__file__).resolve().parent.parent
SLUG = "extract-truck-id"
DEFAULT_INPUT_DIR = ROOT / "data" / "02-extracted-images-from-videos"
DEFAULT_VIDEO_DIR = ROOT / "data" / "01b-videos-converted-to-mp4"
OUTPUT_DIR = ROOT / "data" / f"03-{SLUG}"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
DEFAULT_TEXT_PROMPT = "truck number"


def group_frames_by_video(frames: list[Path]) -> list[tuple[str, list[Path]]]:
    import re
    frame_name_re = re.compile(r"^(.+)_frame\d+$")
    groups: dict[str, list[Path]] = defaultdict(list)
    for path in frames:
        match = frame_name_re.match(path.stem)
        video_id = match.group(1) if match else path.stem
        groups[video_id].append(path)
    return [(video_id, sorted(video_frames)) for video_id, video_frames in sorted(groups.items())]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=None,
        help="Directory of pre-extracted frame images. If not set, runs on --video-dir.",
    )
    parser.add_argument(
        "--video-dir",
        type=Path,
        default=DEFAULT_VIDEO_DIR,
        help="Directory of standard MP4 videos to extract and process.",
    )
    parser.add_argument(
        "--frames-per-video",
        type=int,
        default=12,
        help="Number of frames to extract per video when processing videos.",
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
        help="Process only the first N frames/videos (for testing)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reprocess frames even if labels already exist",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    dirs = ensure_dataset_layout(args.output_dir)
    write_data_yaml(args.output_dir)

    temp_frames_dir = None
    frames = []

    # Decide input source
    if args.input_dir is not None:
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
    else:
        # Process from videos directory
        if not args.video_dir.is_dir():
            # Fall back to default input images directory if no video dir exists
            if DEFAULT_INPUT_DIR.is_dir():
                print(f"Video dir {args.video_dir} not found. Falling back to images from {DEFAULT_INPUT_DIR}")
                frames = sorted(
                    path
                    for path in DEFAULT_INPUT_DIR.iterdir()
                    if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
                )
                if args.limit is not None:
                    frames = frames[: args.limit]
            else:
                print(f"Neither video directory {args.video_dir} nor default image directory {DEFAULT_INPUT_DIR} found.", file=sys.stderr)
                return 1
        else:
            videos = sorted(path for path in args.video_dir.iterdir() if path.is_file() and path.suffix.lower() == ".mp4")
            if args.limit is not None:
                videos = videos[: args.limit]
            if not videos:
                print(f"No videos found in {args.video_dir}", file=sys.stderr)
                return 1
            
            temp_frames_dir = args.output_dir / "temp_extracted_frames"
            temp_frames_dir.mkdir(parents=True, exist_ok=True)
            print(f"Extracting {args.frames_per_video} frames per video from {len(videos)} video(s)...")
            
            for video_path in tqdm(videos, desc="Extracting frames"):
                video_frames = extract_frames_from_video(video_path, temp_frames_dir, args.frames_per_video)
                frames.extend(video_frames)

    if not frames:
        print("No frame images to process.", file=sys.stderr)
        return 1

    video_groups = group_frames_by_video(frames)
    print(f"Loading SAM3 (prompt={args.text_prompt!r}, conf_threshold={args.confidence_threshold})...")
    processor = build_processor(args.confidence_threshold)

    processed = 0
    total_detections = 0
    try:
        for video_id, video_frames in tqdm(video_groups, desc="Videos", unit="video"):
            video_detections = 0
            for image_path in tqdm(video_frames, desc=video_id, leave=False, unit="frame"):
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
            tqdm.write(f"{video_id}: {video_detections} detection(s) across {len(video_frames)} frame(s)")
    finally:
        # Clean up temporary frames folder if it was created
        if temp_frames_dir is not None and temp_frames_dir.exists():
            shutil.rmtree(temp_frames_dir)

    print(
        f"Done. Processed {processed} new frame(s) across {len(video_groups)} video(s), "
        f"{total_detections} detection(s) total. Output: {args.output_dir}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
