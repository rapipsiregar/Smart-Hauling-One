#!/usr/bin/env python3
"""Unified CLI entry point for the ocr-hauling-truck pipeline.

Dispatches commands to the corresponding lab scripts under labs/.
Supports both command-line arguments and an interactive TUI mode.
"""

import sys
import subprocess
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LABS_DIR = ROOT / "labs"
NEXT_DIR = ROOT / "webapp-next"

COMMANDS = {
    "01": {
        "script": "01_download_playlist.py",
        "description": "Download the YouTube playlist to data/01-playlist",
        "aliases": ["download"],
    },
    "01b": {
        "script": "01b_convert_videos_to_mp4.py",
        "description": "Convert all videos in data/01-playlist to mp4 in data/01b-videos-converted-to-mp4 using ffmpeg",
        "aliases": ["convert-mp4"],
    },
    "02": {
        "script": "02_extract_frames.py",
        "description": "Extract 8 evenly-spaced frames from each video in data/01-playlist",
        "aliases": ["extract"],
    },
    "03": {
        "script": "03_segment_truck_id_sam3.py",
        "description": "Segment truck ID regions in extracted frames using SAM 3",
        "aliases": ["segment"],
    },
    "04": {
        "script": "04_ocr_truck_id_paddleocr_vl.py",
        "description": "Run OCR with PaddleOCR-VL 1.6 on segmented truck ID crops",
        "aliases": ["ocr-paddle"],
    },
    "05": {
        "script": "05_ocr_truck_id_nemotron.py",
        "description": "Run OCR with NVIDIA Nemotron OCR v2 on segmented truck ID crops",
        "aliases": ["ocr-nemotron"],
    },
    "06": {
        "script": "06_pipeline_sam3_paddleocr.py",
        "description": "End-to-end video pipeline (extract -> segment -> OCR)",
        "aliases": ["pipeline"],
    },
    "07": {
        "script": "07_pipeline_sam3_nemotron.py",
        "description": "End-to-end video pipeline using Nemotron OCR v2 (via subprocess)",
        "aliases": ["pipeline-nemotron"],
    },
    "08": {
        "script": "08_detect_truck_yolo26.py",
        "description": "Detect trucks/vehicles in playlist videos using YOLO26n",
        "aliases": ["detect-yolo26"],
    },
    "09": {
        "script": "09_train_truck_id_yolo.py",
        "description": "Train YOLO models for Truck ID detection and segmentation",
        "aliases": ["train-yolo26"],
    },
    "10": {
        "script": "10_detect_truck_id_yolo26.py",
        "description": "Run YOLO26n fine-tuned models on videos to detect/segment truck IDs",
        "aliases": ["detect-truck-id"],
    },
    "11": {
        "script": "11_detect_text_paddleocr_vl.py",
        "description": "Run PaddleOCR-VL 1.6 directly on frames to export YOLO dataset",
        "aliases": ["detect-text-paddle"],
    },
    "12": {
        "script": "12_run_custom_model.py",
        "description": "Run the trained model on videos to detect truck IDs and perform OCR",
        "aliases": ["run-custom-model", "run-model"],
    },
    "13": {
        "script": "13_overlay_existing_results.py",
        "description": "Overlay existing JSON inference results onto source videos",
        "aliases": ["overlay"],
    },
    "14": {
        "script": "14_extract_plate_snapshots.py",
        "description": "Extract the clearest detected plate image per video from results",
        "aliases": ["snapshots", "plate-snapshots"],
    },
    "15": {
        "script": "15_store_results_database.py",
        "description": "Clean the database and store all inference results into it",
        "aliases": ["store-db", "database"],
    },
}

LOOKUP = {}
for key, info in COMMANDS.items():
    LOOKUP[key] = info
    for alias in info["aliases"]:
        LOOKUP[alias] = info


def print_help():
    print("Usage: ocr-hauling-truck <command> [args...]")
    print("   or: ocr-hauling-truck (to launch the interactive TUI)")
    print("\nSpecial commands:")
    print("  tui                     Launch the interactive keyboard-navigable TUI")
    print("  web [host] [port]       Launch the Python FastAPI server (default 127.0.0.1:8000)")
    print("  provision-device <code> [--rotate]")
    print("                          Issue an edge-device API key for a registered camera")
    print("  next / web-next         Launch the Next.js 16 + Bun Mining HUD app")
    print("  menu                    Launch the fallback text-input selection menu")
    print("\nAvailable lab commands:")
    for key, info in sorted(COMMANDS.items()):
        aliases_str = ", ".join(info["aliases"])
        print(f"  {key} ({aliases_str})")
        print(f"      {info['description']}")
    print("\nFor help with a specific command, run:")
    print("  ocr-hauling-truck <command> --help")


def run_command(cmd_arg, extra_args):
    info = LOOKUP[cmd_arg]
    script_path = LABS_DIR / info["script"]

    if not script_path.exists():
        print(f"Error: Script {script_path} not found.", file=sys.stderr)
        return 1

    print(f"\n>>> Running: {info['script']} {' '.join(extra_args)}")
    result = subprocess.run([sys.executable, str(script_path), *extra_args])
    return result.returncode


def run_interactive():
    while True:
        print("\n" + "=" * 60)
        print("         Integrated Smart Hauling System — Pipeline CLI")
        print("=" * 60)
        for key, info in sorted(COMMANDS.items()):
            aliases_str = ", ".join(info["aliases"])
            print(f"  [{key}] {info['description']} ({aliases_str})")
        print("  [q]   Quit")
        print("-" * 60)

        try:
            choice = input("Select a command (number/alias) or 'q' to quit: ").strip()
        except EOFError:
            print("\nExiting CLI.")
            sys.exit(0)

        if choice.lower() in ("q", "quit", "exit"):
            print("Exiting CLI. Goodbye!")
            sys.exit(0)

        if not choice:
            continue

        if choice not in LOOKUP:
            print(f"\nError: '{choice}' is not a valid command number or alias.")
            continue

        info = LOOKUP[choice]
        cmd_key = [k for k, v in COMMANDS.items() if v == info][0]

        try:
            args_input = input(
                f"Enter optional arguments for {cmd_key} (e.g. --limit 5): "
            ).strip()
        except EOFError:
            args_input = ""

        extra_args = args_input.split() if args_input else []

        code = run_command(choice, extra_args)
        print(f"\nCommand finished with exit code: {code}")

        try:
            input("\nPress Enter to return to menu...")
        except EOFError:
            pass


def run_nextjs():
    """Launch the Next.js + Bun web application."""
    bun_cmd = shutil.which("bun") or "bun"
    if not NEXT_DIR.is_dir():
        print("Error: webapp-next directory not found.", file=sys.stderr)
        return 1
    print("\n>>> Launching Next.js 16 + Bun Mining HUD Dashboard...")
    print(">>> Operating at http://localhost:3000")
    print("-" * 78)
    return subprocess.run([bun_cmd, "run", "dev"], cwd=str(NEXT_DIR)).returncode


def run_provision_device(args):
    """Issue (or rotate) an edge-device API key for a registered camera.

    The plaintext key is printed exactly once and never stored -- only its hash
    goes to the database (docs/edge-system/SRS.md §7.3). There is deliberately no
    HTTP endpoint for this (API_CONTRACT.md §5).
    """
    if not args or args[0].startswith("-"):
        print("Usage: provision-device <camera_code> [--rotate]", file=sys.stderr)
        return 1

    camera_code = args[0]
    rotating = "--rotate" in args[1:]

    from app.services import cameras, edge_devices

    camera = cameras.get_camera(camera_code)
    if camera is None:
        print(f"Error: no camera registered with code '{camera_code}'.", file=sys.stderr)
        print("Register it first via POST /api/cameras (SRS §7.3 step 1).", file=sys.stderr)
        return 1

    if camera.get("api_key_hash") and not rotating:
        print(
            f"Error: '{camera_code}' is already provisioned.\n"
            "Re-run with --rotate to replace its key "
            "(this immediately invalidates the old one).",
            file=sys.stderr,
        )
        return 1

    plaintext = edge_devices.provision(camera_code)
    action = "Rotated" if rotating else "Provisioned"
    print(f"\n{action} device credential for {camera_code} ({camera.get('name')})")
    print("-" * 78)
    print(f"  {plaintext}")
    print("-" * 78)
    print("Store this now -- it is NOT recoverable. Only its hash was saved.")
    print("Write it to the edge agent's .env as SMART_GATE_API_KEY before first boot.")
    if rotating:
        print("The previous key stopped working immediately.")
    return 0


def main():
    if len(sys.argv) < 2:
        if sys.stdin.isatty():
            try:
                from tui import run_tui
                run_tui(COMMANDS, LABS_DIR)
            except KeyboardInterrupt:
                print("\nExiting. Goodbye!")
                sys.exit(0)
        else:
            try:
                run_interactive()
            except KeyboardInterrupt:
                print("\nExiting. Goodbye!")
                sys.exit(0)
        return

    cmd_arg = sys.argv[1]
    if cmd_arg in ("-h", "--help", "help"):
        print_help()
        sys.exit(0)

    if cmd_arg == "tui":
        from tui import run_tui
        run_tui(COMMANDS, LABS_DIR)
        sys.exit(0)

    if cmd_arg in ("web", "webui", "dashboard"):
        host = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"
        port = int(sys.argv[3]) if len(sys.argv) > 3 else 8000
        from app.main import run as run_web
        run_web(host=host, port=port)
        sys.exit(0)

    if cmd_arg in ("provision-device", "provision"):
        sys.exit(run_provision_device(sys.argv[2:]))

    if cmd_arg in ("next", "web-next", "nextjs"):
        sys.exit(run_nextjs())

    if cmd_arg == "menu":
        try:
            run_interactive()
        except KeyboardInterrupt:
            print("\nExiting. Goodbye!")
        sys.exit(0)

    if cmd_arg not in LOOKUP:
        print(f"Error: Unknown command '{cmd_arg}'", file=sys.stderr)
        print_help()
        sys.exit(1)

    code = run_command(cmd_arg, sys.argv[2:])
    sys.exit(code)


if __name__ == "__main__":
    main()
