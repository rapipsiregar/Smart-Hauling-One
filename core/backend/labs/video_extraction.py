#!/usr/bin/env python3
"""ffmpeg frame extraction helper functions."""

from __future__ import annotations

from pathlib import Path
import subprocess


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


def extract_frames_from_video(video_path: Path, output_dir: Path, count: int) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = video_path.stem
    duration = get_duration(video_path)
    extracted_paths = []

    for frame_num, timestamp in enumerate(frame_timestamps(duration, count), start=1):
        output_path = output_dir / f"{stem}_frame{frame_num:02d}.jpg"
        if not output_path.exists():
            extract_frame(video_path, timestamp, output_path)
        extracted_paths.append(output_path)

    return extracted_paths
