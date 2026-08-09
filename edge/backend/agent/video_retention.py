"""Rolling local video buffer for dispute resolution (SRS §7.1).

Entirely separate from the outbox: different directory, different ceiling, never
competes with crossing delivery for space or I/O priority. Runs regardless of
whether any Detection Window is active.
"""

from __future__ import annotations

import shutil
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from agent.config import (
    VIDEO_MIN_FREE_DISK_FRACTION,
    VIDEO_RETENTION_DAYS,
    VIDEO_SEGMENT_SEC,
)

SWEEP_INTERVAL_SEC = 600  # every 10 minutes


class VideoWriterThread(threading.Thread):
    """Writes rotating segments of the raw feed."""

    def __init__(self, ring, video_dir: Path, fps: int = 15) -> None:
        super().__init__(name="video-writer", daemon=True)
        self.ring = ring
        self.video_dir = Path(video_dir)
        self.fps = fps
        self.video_dir.mkdir(parents=True, exist_ok=True)
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def run(self) -> None:
        import cv2

        last_seq = 0
        while not self._stop.is_set():
            seq, frame = self.ring.wait_for_new(last_seq, timeout=2.0)
            if frame is None:
                continue
            last_seq = seq

            stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
            path = self.video_dir / f"segment-{stamp}.mp4"
            height, width = frame.shape[:2]
            writer = cv2.VideoWriter(
                str(path), cv2.VideoWriter_fourcc(*"mp4v"), self.fps, (width, height)
            )
            segment_end = time.monotonic() + VIDEO_SEGMENT_SEC
            try:
                while not self._stop.is_set() and time.monotonic() < segment_end:
                    seq, frame = self.ring.wait_for_new(last_seq, timeout=2.0)
                    if frame is None:
                        continue
                    last_seq = seq
                    writer.write(frame)
            finally:
                writer.release()


class RetentionSweep(threading.Thread):
    """Deletes oldest segments past the retention window or under disk pressure."""

    def __init__(self, video_dir: Path) -> None:
        super().__init__(name="video-retention", daemon=True)
        self.video_dir = Path(video_dir)
        self.video_dir.mkdir(parents=True, exist_ok=True)
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def _low_disk(self) -> bool:
        usage = shutil.disk_usage(self.video_dir)
        return (usage.free / usage.total) < VIDEO_MIN_FREE_DISK_FRACTION

    def sweep_once(self) -> int:
        """Oldest-first eviction until neither condition holds. Returns count removed."""
        segments = sorted(
            self.video_dir.glob("segment-*.mp4"), key=lambda p: p.stat().st_mtime
        )
        cutoff = time.time() - VIDEO_RETENTION_DAYS * 86400
        removed = 0
        for segment in segments:
            too_old = segment.stat().st_mtime < cutoff
            if not too_old and not self._low_disk():
                break
            segment.unlink(missing_ok=True)
            removed += 1
        return removed

    def run(self) -> None:
        while not self._stop.wait(timeout=SWEEP_INTERVAL_SEC):
            try:
                self.sweep_once()
            except Exception as err:
                print(f"video_retention: sweep failed: {err}")
