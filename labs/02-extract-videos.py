#!/usr/bin/env python3
"""Extract 8 evenly-spaced frames from each video in data/01-playlist."""

from pathlib import Path
import subprocess
import sys

VIDEO_DIR = Path(__file__).resolve().parent.parent / "data" / "01-playlist"
OUTPUT_DIR = (
    Path(__file__).resolve().parent.parent / "data" / "02-extracted-images-from-videos"
)
FRAMES_PER_VIDEO = 8
VIDEO_EXTENSIONS = {".webm", ".mkv", ".mp4", ".avi", ".mov"}


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


def extract_frame(video_path: Path, timestamp: float, output_path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            str(timestamp),
            "-i",
            str(video_path),
            "-frames:v",
            "1",
            "-q:v",
            "2",
            "-y",
            str(output_path),
        ],
        check=True,
    )


def frame_timestamps(duration: float, count: int) -> list[float]:
    if duration <= 0:
        return [0.0] * count
    return [(i + 0.5) * duration / count for i in range(count)]


def extract_frames_from_video(video_path: Path, output_dir: Path) -> int:
    stem = video_path.stem
    duration = get_duration(video_path)
    extracted = 0

    for frame_num, timestamp in enumerate(frame_timestamps(duration, FRAMES_PER_VIDEO), start=1):
        output_path = output_dir / f"{stem}_frame{frame_num:02d}.jpg"
        if output_path.exists():
            continue
        extract_frame(video_path, timestamp, output_path)
        extracted += 1

    return extracted


def main() -> int:
    if not VIDEO_DIR.is_dir():
        print(f"Video directory not found: {VIDEO_DIR}", file=sys.stderr)
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    videos = sorted(
        path
        for path in VIDEO_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS
    )

    if not videos:
        print(f"No videos found in {VIDEO_DIR}", file=sys.stderr)
        return 1

    total_extracted = 0
    for video_path in videos:
        print(f"Extracting frames from {video_path.name}...")
        total_extracted += extract_frames_from_video(video_path, OUTPUT_DIR)

    print(f"Done. Extracted {total_extracted} new frame(s) to {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
