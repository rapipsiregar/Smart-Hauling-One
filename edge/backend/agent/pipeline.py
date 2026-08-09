"""Detection Window state machine (``docs/edge-system/SRS.md`` §3.2).

One truck passing the gate == one Detection Window == one crossing event. The
window opens on the first qualifying YOLO box and closes on either the duration
cap or a grace period with no detections.

Transcribed from SRS §3.2's algorithm. If you change the logic here, change the
spec first -- this file is not the place to improvise.
"""

from __future__ import annotations

import queue

from agent.config import (
    NO_DETECTION_GRACE_SEC,
    OCR_MIN_AREA,
    POST_WINDOW_COOLDOWN_SEC,
    TunableStore,
)

IDLE = "IDLE"
ACTIVE = "ACTIVE"


def iou(box_a, box_b) -> float:
    """Intersection-over-union of two ``(x0, y0, x1, y1)`` boxes."""
    ax0, ay0, ax1, ay1 = box_a
    bx0, by0, bx1, by1 = box_b
    ix0, iy0 = max(ax0, bx0), max(ay0, by0)
    ix1, iy1 = min(ax1, bx1), min(ay1, by1)
    iw, ih = max(0.0, ix1 - ix0), max(0.0, iy1 - iy0)
    intersection = iw * ih
    if intersection <= 0:
        return 0.0
    area_a = max(0.0, ax1 - ax0) * max(0.0, ay1 - ay0)
    area_b = max(0.0, bx1 - bx0) * max(0.0, by1 - by0)
    union = area_a + area_b - intersection
    return intersection / union if union > 0 else 0.0


def encode_jpeg(image) -> bytes:
    """JPEG-encode a frame. Imported lazily so this module works without cv2."""
    import cv2

    ok, buffer = cv2.imencode(".jpg", image)
    return buffer.tobytes() if ok else b""


class DetectionWindow:
    """The per-device runtime state from SRS §3.2, as an object.

    Kept separate from the inference loop so it can be unit-tested with synthetic
    detections -- no model, no camera.
    """

    def __init__(self, tunables: TunableStore, finalizer_queue: queue.Queue) -> None:
        self._tunables = tunables
        self._queue = finalizer_queue
        self.state = IDLE
        self.window_start_ts: float | None = None
        self.last_qualifying_ts: float | None = None
        self.cooldown_until = 0.0
        self.reads: list[dict] = []
        self.last_ocr_box = None
        self.last_yolo_ts = 0.0
        self.last_ocr_ts = 0.0

    # -- throttles ------------------------------------------------------------

    def should_run_yolo(self, now: float) -> bool:
        """``yolo_fps`` throttle -- skip this frame if we are ahead of schedule."""
        config = self._tunables.get()
        if now - self.last_yolo_ts < 1.0 / max(1, config.yolo_fps):
            return False
        self.last_yolo_ts = now
        return True

    def wants_ocr(self, box, now: float) -> bool:
        """The four gates from SRS §3.2 step 3, in order.

        ``DETECT_TRIGGER_CONF`` is applied by YOLO itself (as its ``conf=``
        argument), so ``boxes`` already excludes anything below it. If an operator
        sets ``ocr_min_conf`` below that floor, this check becomes a no-op -- SRS
        §3.2 calls that out as expected, not a bug.
        """
        config = self._tunables.get()
        area = (box["x1"] - box["x0"]) * (box["y1"] - box["y0"])
        if box["conf"] < config.ocr_min_conf:
            return False
        if area < OCR_MIN_AREA:
            return False
        if self.last_ocr_box is not None:
            bbox = (box["x0"], box["y0"], box["x1"], box["y1"])
            if iou(bbox, self.last_ocr_box) >= config.dedup_iou:
                return False
        # The live-only throttle: the batch pipeline has no equivalent.
        if (now - self.last_ocr_ts) < 1.0 / max(1, config.ocr_fps):
            return False
        return True

    # -- recording ------------------------------------------------------------

    def record_read(
        self,
        *,
        text: str,
        weight: float,
        det_conf: float,
        ocr_conf: float,
        now: float,
        crop_jpeg: bytes,
    ) -> None:
        self.reads.append({
            "text": text, "weight": weight, "det_conf": det_conf,
            "ocr_conf": ocr_conf, "ts": now, "crop_jpeg": crop_jpeg,
        })

    def note_ocr(self, box, now: float) -> None:
        self.last_ocr_ts = now
        self.last_ocr_box = (box["x0"], box["y0"], box["x1"], box["y1"])

    # -- state transitions ----------------------------------------------------

    def _open_window(self, now: float) -> None:
        self.state = ACTIVE
        self.window_start_ts = now
        self.last_qualifying_ts = now
        self.reads = []
        self.last_ocr_box = None      # dedup reference always starts clean per window

    def _close_window(self, now: float) -> None:
        # Hand off and return immediately -- consensus and JPEG encoding must
        # never block frame capture (SRS §3.1 Window Finalizer).
        self._queue.put((self.window_start_ts, now, self.reads))
        self.state = IDLE
        self.window_start_ts = None
        self.last_qualifying_ts = None
        self.reads = []
        self.cooldown_until = now + POST_WINDOW_COOLDOWN_SEC

    def begin_frame(self, has_boxes: bool, now: float) -> bool:
        """Advance IDLE->ACTIVE. Returns True if OCR work should happen now."""
        if self.state == IDLE:
            if has_boxes and now >= self.cooldown_until:
                self._open_window(now)
                return True
            return False
        if has_boxes:
            self.last_qualifying_ts = now
        return True

    def end_frame(self, now: float) -> bool:
        """Close the window if either condition is met. Returns True if closed.

        Why the cooldown exists: without it, a truck whose trailing edge causes one
        qualifying frame right as the duration cap is reached could immediately
        retrigger a second, spurious window for the same physical truck.
        """
        if self.state != ACTIVE or self.window_start_ts is None:
            return False
        config = self._tunables.get()
        duration = now - self.window_start_ts
        gap = now - (self.last_qualifying_ts or self.window_start_ts)
        if duration >= config.detect_window_sec or gap >= NO_DETECTION_GRACE_SEC:
            self._close_window(now)
            return True
        return False
