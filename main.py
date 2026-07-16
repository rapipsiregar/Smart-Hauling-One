#!/usr/bin/env python3
"""Unified CLI entry point for the ocr-hauling-truck pipeline.

Dispatches commands to the corresponding lab scripts under labs/.
"""

import sys
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LABS_DIR = ROOT / "labs"

# Mapping of command aliases and lab numbers to lab script filenames and descriptions.
COMMANDS = {
    "01": {
        "script": "01-download-playlist.py",
        "description": "Download the YouTube playlist to data/01-playlist",
        "aliases": ["download"],
    },
    "02": {
        "script": "02-extract-videos.py",
        "description": "Extract 8 evenly-spaced frames from each video in data/01-playlist",
        "aliases": ["extract"],
    },
    "03": {
        "script": "03-extract-truck-id.py",
        "description": "Segment truck ID regions in extracted frames using SAM 3",
        "aliases": ["segment"],
    },
    "04": {
        "script": "04-ocr-truck-id-using-paddle-ocr-vl-1.6.py",
        "description": "Run OCR with PaddleOCR-VL 1.6 on segmented truck ID crops",
        "aliases": ["ocr-paddle"],
    },
    "05": {
        "script": "05-ocr-truck-id-using-nvidia-nemotron-ocr-2.py",
        "description": "Run OCR with NVIDIA Nemotron OCR v2 on segmented truck ID crops",
        "aliases": ["ocr-nemotron"],
    },
    "06": {
        "script": "06-extract-video-using-sam3-and-ocr.py",
        "description": "End-to-end video pipeline (extract -> segment -> OCR)",
        "aliases": ["pipeline"],
    },
    "07": {
        "script": "07-extract-video-using-sam3-and-ocr-using-nvidia-nemotron-ocr-v2.py",
        "description": "End-to-end video pipeline using Nemotron OCR v2 (via subprocess)",
        "aliases": ["pipeline-nemotron"],
    },
}

# Expand aliases for quick lookup
LOOKUP = {}
for key, info in COMMANDS.items():
    LOOKUP[key] = info
    for alias in info["aliases"]:
        LOOKUP[alias] = info


def print_help():
    print("Usage: ocr-hauling-truck <command> [args...]")
    print("\nAvailable commands:")
    for key, info in sorted(COMMANDS.items()):
        aliases_str = ", ".join(info["aliases"])
        print(f"  {key} ({aliases_str})")
        print(f"      {info['description']}")
    print("\nFor help with a specific command, run:")
    print("  ocr-hauling-truck <command> --help")


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help", "help"):
        print_help()
        sys.exit(0)

    cmd_arg = sys.argv[1]
    if cmd_arg not in LOOKUP:
        print(f"Error: Unknown command '{cmd_arg}'", file=sys.stderr)
        print_help()
        sys.exit(1)

    info = LOOKUP[cmd_arg]
    script_path = LABS_DIR / info["script"]

    if not script_path.exists():
        print(f"Error: Script {script_path} not found.", file=sys.stderr)
        sys.exit(1)

    # Re-execute the process with the corresponding lab script.
    # Pass all remaining arguments to the script.
    os.execv(sys.executable, [sys.executable, str(script_path), *sys.argv[2:]])


if __name__ == "__main__":
    main()
