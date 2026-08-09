#!/usr/bin/env python3
"""Convert all videos in data/01-playlist to mp4 format in data/01b-videos-converted-to-mp4 using ffmpeg."""

from pathlib import Path
import subprocess
import sys
import time

VIDEO_DIR = Path(__file__).resolve().parent.parent / "data" / "01-playlist"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "01b-videos-converted-to-mp4"
VIDEO_EXTENSIONS = {".webm", ".mkv", ".mp4", ".avi", ".mov"}


def convert_video(video_path: Path, output_path: Path) -> None:
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "warning",
        "-y",
        "-i",
        str(video_path),
        "-c:v",
        "libx264",
        "-preset",
        "superfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        str(output_path),
    ]
    subprocess.run(cmd, check=True)


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

    total_videos = len(videos)
    print(f"Found {total_videos} video(s) to convert.")

    converted_count = 0
    start_time = time.time()

    for idx, video_path in enumerate(videos, 1):
        output_path = OUTPUT_DIR / f"{video_path.stem}.mp4"
        print(f"[{idx}/{total_videos}] Converting {video_path.name} -> {output_path.name}...")
        
        if output_path.exists():
            print(f"  Already exists. Skipping.")
            continue

        try:
            convert_video(video_path, output_path)
            converted_count += 1
            print(f"  Successfully converted.")
        except subprocess.CalledProcessError as e:
            print(f"  Error converting {video_path.name}: {e}", file=sys.stderr)
            # Remove partial/corrupted output file if it was created
            if output_path.exists():
                output_path.unlink()

    elapsed = time.time() - start_time
    print(f"\nDone. Converted {converted_count} new video(s) to {OUTPUT_DIR} in {elapsed:.2f} seconds.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
