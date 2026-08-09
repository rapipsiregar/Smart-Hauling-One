"""RTSP capture into a shallow ring buffer (``docs/edge-system/SRS.md`` §3.1).

The buffer is deliberately shallow (depth 2-3): processing must always work close
to live rather than draining a backlog. Dropping frames when inference falls
behind is acceptable -- there is no "process every frame" requirement.

One capture, many consumers: the inference loop, the live-view WHIP push, and the
local video writer all read this same buffer. Opening a second RTSP connection
would risk exceeding the camera's concurrent-client limit (SRS §11).
"""

from __future__ import annotations

import threading
from collections import deque

from agent.backoff import backoff_delay

RING_DEPTH = 3


class FrameRing:
    """Most-recent-frames buffer, safe for one writer and many readers."""

    def __init__(self, depth: int = RING_DEPTH) -> None:
        self._frames: deque = deque(maxlen=depth)
        self._lock = threading.Lock()
        self._updated = threading.Condition(self._lock)
        self._seq = 0

    def push(self, frame) -> None:
        with self._updated:
            self._seq += 1
            self._frames.append((self._seq, frame))
            self._updated.notify_all()

    def latest(self):
        """Newest ``(seq, frame)``, or ``(0, None)`` if nothing captured yet."""
        with self._lock:
            return self._frames[-1] if self._frames else (0, None)

    def wait_for_new(self, last_seq: int, timeout: float = 1.0):
        """Block until a frame newer than ``last_seq`` arrives, or time out."""
        with self._updated:
            if self._frames and self._frames[-1][0] > last_seq:
                return self._frames[-1]
            self._updated.wait(timeout=timeout)
            if self._frames and self._frames[-1][0] > last_seq:
                return self._frames[-1]
            return (last_seq, None)


class CaptureThread(threading.Thread):
    """Reads the camera continuously, reconnecting with backoff on failure.

    ``cv2.VideoCapture`` accepts a filesystem path exactly as it accepts an RTSP
    URL, which is what makes local end-to-end testing possible: point
    ``SMART_GATE_RTSP_URL`` at a clip and the agent runs unmodified.
    """

    def __init__(self, source: str, ring: FrameRing) -> None:
        super().__init__(name="capture", daemon=True)
        self.source = source
        self.ring = ring
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def run(self) -> None:
        import cv2

        attempt = 0
        while not self._stop.is_set():
            capture = cv2.VideoCapture(self.source)
            # Keep OpenCV's own buffer at 1 so we read live frames, not stale ones.
            capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if not capture.isOpened():
                attempt += 1
                delay = backoff_delay(attempt)
                print(f"capture: cannot open {self.source}; retrying in {delay:.1f}s")
                capture.release()
                self._stop.wait(timeout=delay)
                continue

            print(f"capture: connected to {self.source}")
            attempt = 0
            while not self._stop.is_set():
                ok, frame = capture.read()
                if not ok:
                    print("capture: stream ended or read failed; reconnecting")
                    break
                self.ring.push(frame)
            capture.release()

        print("capture: stopped")
