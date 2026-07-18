"""ffmpeg helpers for reading/writing raw BGR video frames."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


def probe_video(video_path: Path) -> tuple[int, int, float, int]:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate,nb_frames",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(video_path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    payload = json.loads(result.stdout)
    stream = payload["streams"][0]
    width = int(stream["width"])
    height = int(stream["height"])
    num, den = stream["r_frame_rate"].split("/")
    fps = float(num) / float(den) if float(den) else 30.0

    nb_frames = stream.get("nb_frames")
    if nb_frames and nb_frames != "N/A":
        frame_count = int(nb_frames)
    else:
        duration = float(payload.get("format", {}).get("duration") or 0)
        frame_count = max(1, int(duration * fps))
    return width, height, fps, frame_count


def open_frame_reader(video_path: Path) -> subprocess.Popen:
    return subprocess.Popen(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(video_path),
            "-f",
            "rawvideo",
            "-pix_fmt",
            "bgr24",
            "-",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def open_frame_writer(
    output_path: Path, width: int, height: int, fps: float
) -> subprocess.Popen:
    return subprocess.Popen(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "bgr24",
            "-s",
            f"{width}x{height}",
            "-r",
            f"{fps:.6f}",
            "-i",
            "-",
            "-an",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(output_path),
        ],
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
