#!/usr/bin/env python3
"""Interactive Terminal User Interface (TUI) for the ocr-hauling-truck CLI pipeline."""

import sys
import os
import subprocess
import shutil
import json
from pathlib import Path

# Enable VT100 escape sequences on Windows
if os.name == 'nt':
    os.system('')

# Cross-platform getch
try:
    import msvcrt
    def getch():
        ch = msvcrt.getch()
        if ch in (b'\x00', b'\xe0'):
            ch2 = msvcrt.getch()
            if ch2 == b'H': return "up"
            if ch2 == b'P': return "down"
            return None
        if ch == b'\r': return "enter"
        if ch == b'\x1b': return "esc"
        try:
            return ch.decode('utf-8').lower()
        except UnicodeDecodeError:
            return None
except ImportError:
    import tty
    import termios
    import select
    def getch():
        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setraw(sys.stdin.fileno())
            ch = sys.stdin.read(1)
            if ch == '\x1b':
                r, _, _ = select.select([sys.stdin], [], [], 0.05)
                if r:
                    ch2 = sys.stdin.read(1)
                    if ch2 == '[':
                        ch3 = sys.stdin.read(1)
                        if ch3 == 'A': return "up"
                        if ch3 == 'B': return "down"
                return "esc"
            if ch in ('\n', '\r'): return "enter"
            return ch.lower()
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)


# Configuration Options
settings = {
    "gpu": True,
    "max_frames": 100,      # None, 10, 50, 100, 500, 1000
    "confidence": 0.25,     # 0.25, 0.40, 0.50, 0.60, 0.75
    "limit": 3,             # None, 1, 3, 5, 10
    "stride": 3,            # 1, 2, 3, 5, 10
    "save_video": False,
}

max_frames_opts = [None, 10, 50, 100, 500, 1000]
conf_opts = [0.25, 0.40, 0.50, 0.60, 0.75]
limit_opts = [None, 1, 3, 5, 10]
stride_opts = [1, 2, 3, 5, 10]


def check_system_stats():
    gpu_info = "N/A"
    try:
        import torch
        if torch.cuda.is_available():
            gpu_info = torch.cuda.get_device_name(0)
    except ImportError:
        pass

    playlist_path = Path("data/01-playlist")
    vids = len(list(playlist_path.glob("*.mp4"))) if playlist_path.is_dir() else 0

    latest_run = "N/A"
    results_file = Path("data/12-run-custom-model-results.json")
    if results_file.exists():
        try:
            res = json.loads(results_file.read_text())
            latest_run = f"{res.get('videos_processed', 0)} vids ({res.get('total_elapsed_seconds', 0)}s)"
        except Exception:
            pass

    return gpu_info, vids, latest_run


def draw_tui(commands, selected_idx):
    gpu_info, vids, latest_run = check_system_stats()

    # Clear screen and hide cursor
    sys.stdout.write("\033[2J\033[H\033[?25l")

    # Render layout
    print("\033[1;36m+------------------------------------------------------------------------------+\033[0m")
    print("\033[1;36m|                  SMART GATE: HAULING TRUCK INFERENCE ENGINE                  |\033[0m")
    print("\033[1;36m+----------------------------------------------+-------------------------------+\033[0m")

    # Body rows
    menu_h = len(commands)
    rows = max(menu_h, 12)

    for r in range(rows):
        # Left side: command selection
        left_str = " " * 44
        if r < menu_h:
            key, info = commands[r]
            line = f"[{key}] {info['description'][:30]:<30}"
            if r == selected_idx:
                left_str = f"\033[1;7;36m > {line:<41}\033[0m"
            else:
                left_str = f"   {line:<41}"

        # Right side: system status & settings
        right_str = ""
        if r == 0:
            right_str = f"\033[1;33mSYSTEM METRICS\033[0m"
        elif r == 1:
            right_str = f"GPU: {gpu_info[:24]}"
        elif r == 2:
            right_str = f"Playlist Videos: {vids}"
        elif r == 3:
            right_str = f"Latest Run: {latest_run[:20]}"
        elif r == 4:
            right_str = "-" * 29
        elif r == 5:
            right_str = f"\033[1;33mSETTINGS (Press Key to Cycle)\033[0m"
        elif r == 6:
            device = "cuda" if settings["gpu"] else "cpu"
            right_str = f"[g] Use GPU: \033[1;32m{device:<6}\033[0m"
        elif r == 7:
            val = settings["max_frames"] or "All"
            right_str = f"[f] Max Frames: \033[1;32m{val:<6}\033[0m"
        elif r == 8:
            val = settings["confidence"]
            right_str = f"[c] Confidence: \033[1;32m{val:<6}\033[0m"
        elif r == 9:
            val = settings["limit"] or "All"
            right_str = f"[l] Video Limit: \033[1;32m{val:<6}\033[0m"
        elif r == 10:
            val = settings["stride"]
            right_str = f"[s] Frame Stride: \033[1;32m{val:<5}\033[0m"
        elif r == 11:
            val = "Yes" if settings["save_video"] else "No"
            right_str = f"[v] Render Video: \033[1;32m{val:<5}\033[0m"

        print(f"\033[1;36m|\033[0m {left_str:<44} \033[1;36m|\033[0m {right_str:<29} \033[1;36m|\033[0m")

    print("\033[1;36m+----------------------------------------------+-------------------------------+\033[0m")
    print("\033[1;33m UP/DOWN move * g/f/c/l/s/v cycle opts * Enter run * q/Esc exit             \033[0m")
    print("\033[1;36m+------------------------------------------------------------------------------+\033[0m")
    sys.stdout.flush()


def run_tui(commands_dict, labs_dir):
    commands = sorted(commands_dict.items())
    # Append special non-lab entries to launch the Web UIs.
    commands.append(("next", {
        "script": "__next__",
        "description": "Launch Next.js 16 + Bun Mining HUD App (http://localhost:3000)",
        "aliases": ["web-next"],
    }))
    commands.append(("web", {
        "script": "__web__",
        "description": "Launch FastAPI server (http://127.0.0.1:8000)",
        "aliases": ["webui"],
    }))
    selected_idx = 0

    try:
        while True:
            draw_tui(commands, selected_idx)
            key = getch()

            if key == "up":
                selected_idx = (selected_idx - 1) % len(commands)
            elif key == "down":
                selected_idx = (selected_idx + 1) % len(commands)
            elif key == "g":
                settings["gpu"] = not settings["gpu"]
            elif key == "f":
                settings["max_frames"] = max_frames_opts[(max_frames_opts.index(settings["max_frames"]) + 1) % len(max_frames_opts)]
            elif key == "c":
                settings["confidence"] = conf_opts[(conf_opts.index(settings["confidence"]) + 1) % len(conf_opts)]
            elif key == "l":
                settings["limit"] = limit_opts[(limit_opts.index(settings["limit"]) + 1) % len(limit_opts)]
            elif key == "s":
                settings["stride"] = stride_opts[(stride_opts.index(settings["stride"]) + 1) % len(stride_opts)]
            elif key == "v":
                settings["save_video"] = not settings["save_video"]
            elif key in ("q", "esc"):
                sys.stdout.write("\033[?25h\n")
                sys.stdout.flush()
                print("Exiting TUI. Goodbye!")
                break
            elif key == "enter":
                sys.stdout.write("\033[?25h\033[2J\033[H")
                sys.stdout.flush()

                key_cmd, info = commands[selected_idx]

                # Special entry: launch Next.js 16 + Bun app
                if key_cmd == "next":
                    next_dir = labs_dir.parent / "webapp-next"
                    bun_cmd = shutil.which("bun") or "bun"
                    print("\n>>> Launching Next.js 16 + Bun Mining HUD Dashboard...")
                    print(">>> Operating at http://localhost:3000")
                    print(">>> Press Ctrl+C to stop.")
                    print("-" * 78)
                    try:
                        subprocess.run([bun_cmd, "run", "dev"], cwd=str(next_dir))
                    except KeyboardInterrupt:
                        print("\n[Next.js app stopped]")
                    except Exception as e:
                        print(f"\n[Next.js app error: {e}]")
                    print("-" * 78)
                    try:
                        input("Press Enter to return to menu...")
                    except (EOFError, KeyboardInterrupt):
                        pass
                    continue

                # Special entry: launch FastAPI server
                if key_cmd == "web":
                    main_py = labs_dir.parent / "main.py"
                    print("\n>>> Starting FastAPI Web Server at http://127.0.0.1:8000")
                    print(">>> Open that address in your browser. Press Ctrl+C here to stop.")
                    print("-" * 78)
                    try:
                        subprocess.run([sys.executable, str(main_py), "web"])
                    except KeyboardInterrupt:
                        print("\n[Web UI stopped]")
                    except Exception as e:
                        print(f"\n[Web UI error: {e}]")
                    print("-" * 78)
                    try:
                        input("Press Enter to return to menu...")
                    except (EOFError, KeyboardInterrupt):
                        pass
                    continue

                script_path = labs_dir / info["script"]

                extra_args = []
                if key_cmd == "12":
                    device_str = "cuda" if settings["gpu"] else "cpu"
                    extra_args.extend(["--device", device_str])
                    if settings["max_frames"] is not None:
                        extra_args.extend(["--max-frames", str(settings["max_frames"])])
                    if settings["confidence"] is not None:
                        extra_args.extend(["--confidence", str(settings["confidence"])])
                    if settings["limit"] is not None:
                        extra_args.extend(["--limit", str(settings["limit"])])
                    if settings["stride"] and settings["stride"] > 1:
                        extra_args.extend(["--frame-stride", str(settings["stride"])])
                    if settings["save_video"]:
                        extra_args.append("--save-video")
                else:
                    print(f"=== Running Command: {key_cmd} ({info['script']}) ===")
                    print(info["description"])
                    print("-" * 60)
                    try:
                        args_input = input("Enter optional arguments (e.g. --limit 5) or press Enter: ").strip()
                    except (EOFError, KeyboardInterrupt):
                        args_input = ""
                    if args_input:
                        extra_args = args_input.split()

                print(f"\n>>> Executing: {sys.executable} {info['script']} {' '.join(extra_args)}")
                print("-" * 78)

                try:
                    subprocess.run([sys.executable, str(script_path), *extra_args])
                except KeyboardInterrupt:
                    print("\n[Execution interrupted by user]")
                except Exception as e:
                    print(f"\n[Execution error: {e}]")

                print("-" * 78)
                try:
                    input("Press Enter to return to menu...")
                except (EOFError, KeyboardInterrupt):
                    pass
    finally:
        sys.stdout.write("\033[?25h")
        sys.stdout.flush()
