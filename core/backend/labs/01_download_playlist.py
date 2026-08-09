#!/usr/bin/env python3
"""Download the Truck Hauling 2026 YouTube playlist to data/01-playlist."""

from pathlib import Path
import subprocess
import sys

PLAYLIST_URL = "https://www.youtube.com/playlist?list=PLUMliCHhdpQQ"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "01-playlist"
ARCHIVE_FILE = OUTPUT_DIR / ".yt-dlp-archive"


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    cmd = [
        "yt-dlp",
        "--no-update",
        "--continue",
        "--no-overwrites",
        "--download-archive",
        str(ARCHIVE_FILE),
        "--output",
        str(OUTPUT_DIR / "%(id)s.%(ext)s"),
        PLAYLIST_URL,
    ]

    return subprocess.call(cmd)


if __name__ == "__main__":
    sys.exit(main())
