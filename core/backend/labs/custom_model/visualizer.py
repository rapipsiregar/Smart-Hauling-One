"""Draws detected YOLO bounding boxes and PaddleOCR-VL text labels onto frames,
saving the annotated video output to disk.
"""

from __future__ import annotations

from pathlib import Path
import cv2
import numpy as np

# Output folder for processed video results
OUTPUT_DIR = Path("data/12-annotated-videos")


def _fmt_timestamp(seconds: float) -> str:
    """Format seconds as MM:SS.mmm for on-frame display."""
    total_ms = int(round(seconds * 1000))
    minutes, rem = divmod(total_ms, 60_000)
    secs, ms = divmod(rem, 1000)
    return f"{minutes:02d}:{secs:02d}.{ms:03d}"


def draw_annotations(
    frame: np.ndarray,
    detections_this_frame: list[dict],
    voted_id: str,
    vote_conf: float,
    timestamp: float | None = None,
) -> np.ndarray:
    """Draw boxes and text on the frame. Modifies copy of frame."""
    annotated = frame.copy()
    h, w = frame.shape[:2]

    # 1. Draw top dashboard banner
    banner_h = int(h * 0.08)
    cv2.rectangle(annotated, (0, 0), (w, banner_h), (0, 0, 0), -1)
    
    label_text = f"Integrated Smart Hauling System ID: {voted_id} (conf: {vote_conf:.2f})"
    font_scale = max(0.5, banner_h / 60.0)
    thickness = max(1, int(banner_h / 30))
    
    cv2.putText(
        annotated,
        label_text,
        (20, int(banner_h * 0.65)),
        cv2.FONT_HERSHEY_SIMPLEX,
        font_scale,
        (0, 255, 255),  # Cyan
        thickness,
        cv2.LINE_AA,
    )

    # Right-aligned timestamp in the banner
    if timestamp is not None:
        ts_text = f"T {_fmt_timestamp(timestamp)}"
        (tw, _), _ = cv2.getTextSize(ts_text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
        cv2.putText(
            annotated,
            ts_text,
            (max(20, w - tw - 20), int(banner_h * 0.65)),
            cv2.FONT_HERSHEY_SIMPLEX,
            font_scale,
            (0, 255, 255),
            thickness,
            cv2.LINE_AA,
        )

    # 2. Draw detections
    for det in detections_this_frame:
        x0, y0, x1, y1 = det["bbox"]
        det_conf = det["detection_confidence"]
        ocr_text = det.get("raw_text", "")
        ocr_conf = det.get("ocr_confidence", 0.0)

        # Draw plate bounding box (Yellow)
        cv2.rectangle(annotated, (x0, y0), (x1, y1), (0, 255, 0), thickness + 1)

        # Label details
        tag = f"PLATE ({det_conf:.2f})"
        if ocr_text:
            tag += f" OCR: {ocr_text} ({ocr_conf:.2f})"

        # Calculate text background size
        t_font = cv2.FONT_HERSHEY_SIMPLEX
        t_scale = font_scale * 0.75
        (tw, th), baseline = cv2.getTextSize(tag, t_font, t_scale, thickness)
        
        # Draw text background banner just above the plate box
        ty = max(y0 - 5, th + baseline + 5)
        cv2.rectangle(annotated, (x0, ty - th - 5), (x0 + tw + 10, ty + baseline), (0, 0, 0), -1)
        
        # Write text
        cv2.putText(
            annotated,
            tag,
            (x0 + 5, ty - 2),
            t_font,
            t_scale,
            (0, 255, 255),
            thickness,
            cv2.LINE_AA,
        )

    return annotated


def create_annotated_video(
    video_path: Path,
    detections: list[dict],
    voted_id: str,
    vote_conf: float,
    frame_stride: int = 1,
    out_dir: Path | None = None,
    out_name: str | None = None,
) -> Path | None:
    """Read source video, render matching annotations, and write result to file."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None

    # Video properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    target_dir = out_dir or OUTPUT_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    out_path = target_dir / (out_name or f"annotated_{video_path.name}")
    temp_path = out_path.with_name(f"temp_{out_path.name}")

    # Use MP4V codec for temporary OpenCV output
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(temp_path), fourcc, fps, (width, height))

    # Map detections by frame index for quick lookup
    frame_dets = {}
    for d in detections:
        f_idx = d["frame_index"]
        if f_idx not in frame_dets:
            frame_dets[f_idx] = []
        frame_dets[f_idx].append(d)

    frame_idx = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            # Draw detections active on this frame index (even if frame skipped in stride)
            dets = frame_dets.get(frame_idx, [])

            # To avoid flashing boxes, we can persist the last active detections
            # during skipped frames to make video playback smooth.
            if not dets and frame_stride > 1:
                # Find most recent previous frame with detections within stride limit
                for back in range(1, frame_stride):
                    prev_idx = frame_idx - back
                    if prev_idx in frame_dets:
                        dets = frame_dets[prev_idx]
                        break

            annotated = draw_annotations(
                frame, dets, voted_id, vote_conf, timestamp=frame_idx / fps
            )
            out.write(annotated)
            frame_idx += 1
    finally:
        cap.release()
        out.release()

    # Transcode temp_path to browser-compatible H.264 (MP4) using ffmpeg
    if temp_path.exists():
        import subprocess
        try:
            try:
                from app.utils.media import get_ffmpeg_binaries
                ffmpeg_cmd, _ = get_ffmpeg_binaries()
            except Exception:
                ffmpeg_cmd = "ffmpeg"

            cmd = [
                ffmpeg_cmd,
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(temp_path),
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-crf",
                "23",
                "-preset",
                "superfast",
                str(out_path),
            ]
            subprocess.run(cmd, check=True)
            temp_path.unlink()  # Clean up temp file
        except Exception:
            # Fallback: rename temp_path directly if ffmpeg fails or is not available
            if temp_path.exists():
                if out_path.exists():
                    out_path.unlink()
                temp_path.rename(out_path)

    return out_path
