"""Video transcoding helpers so annotated clips play in browsers (H.264)."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


def get_ffmpeg_binaries() -> tuple[str, str]:
    """Locate ffmpeg/ffprobe, falling back to a winget install on Windows."""
    ffmpeg_cmd = shutil.which("ffmpeg")
    ffprobe_cmd = shutil.which("ffprobe")

    if ffmpeg_cmd and ffprobe_cmd:
        return "ffmpeg", "ffprobe"

    try:
        username = os.getlogin()
        winget_path = Path(f"C:/Users/{username}/AppData/Local/Microsoft/WinGet/Packages")
        if winget_path.is_dir():
            found_ffmpeg = sorted(list(winget_path.glob("**/bin/ffmpeg.exe")))
            found_ffprobe = sorted(list(winget_path.glob("**/bin/ffprobe.exe")))

            ffmpeg_match = next((f for f in found_ffmpeg if "Gyan" in str(f)), None) or (found_ffmpeg[0] if found_ffmpeg else None)
            ffprobe_match = next((f for f in found_ffprobe if "Gyan" in str(f)), None) or (found_ffprobe[0] if found_ffprobe else None)

            if ffmpeg_match and ffprobe_match:
                return str(ffmpeg_match.resolve()), str(ffprobe_match.resolve())
    except Exception:
        pass

    return ffmpeg_cmd or "ffmpeg", ffprobe_cmd or "ffprobe"


def ensure_browser_compatible(video_path: Path) -> Path:
    """Transcode ``video_path`` to H.264 in-place if it is not already.

    A sidecar ``.h264_ok`` marker records success so repeat calls are cheap.
    """
    if not video_path.exists():
        return video_path

    marker = video_path.with_suffix(video_path.suffix + ".h264_ok")
    if marker.exists():
        return video_path

    ffmpeg_cmd, ffprobe_cmd = get_ffmpeg_binaries()

    is_h264 = False
    try:
        cmd = [
            ffprobe_cmd,
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=codec_name",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(video_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=5)
        codec = result.stdout.strip()
        if codec == "h264":
            is_h264 = True
    except Exception:
        pass

    if is_h264:
        try:
            marker.touch()
        except Exception:
            pass
        return video_path

    temp_path = video_path.with_name(f"transcoding_{video_path.name}")
    try:
        cmd = [
            ffmpeg_cmd,
            "-hide_banner",
            "-loglevel", "error",
            "-y",
            "-i", str(video_path),
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-crf", "23",
            "-preset", "superfast",
            str(temp_path)
        ]
        subprocess.run(cmd, check=True, timeout=120)
        if temp_path.exists():
            if video_path.exists():
                video_path.unlink()
            temp_path.rename(video_path)
            marker.touch()
    except Exception:
        if temp_path.exists():
            try:
                temp_path.unlink()
            except Exception:
                pass

    return video_path
