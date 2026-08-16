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

LEFT = "left"
RIGHT = "right"

# How far the truck's centroid must travel across the frame, as a fraction of
# frame width, before the window is willing to call a direction.
#
# This replaces the old "did the centroid change which half of the frame it was
# in" test, which needed the truck to pass through a fixed frame_width/2 line.
# That line is an artefact of where the camera happens to point, not of the
# gate: on the reference footage the lane sits off-centre, so a truck could
# traverse most of the frame without ever crossing it and the window returned
# None -- a real crossing that then belonged to neither the inside nor the
# outside list. Net travel asks the question the gate actually cares about
# ("which way did it move?") and gets an answer wherever the lane is framed.
#
# 0.12 is above the centroid jitter of a stationary truck (box corners wobble a
# few pixels between frames, well under 2% of width) and far below the travel of
# any vehicle genuinely passing through.
MIN_TRAVEL_FRACTION = 0.12

# Which way a truck moves across this device's frame when it is ARRIVING.
#
# Physical property of how the camera is mounted, not an operator preference,
# which is why it is boot-time configuration (SMART_GATE_INBOUND_AXIS) rather
# than an induk-pushed tunable. The old code hardcoded left-to-right == inbound;
# this gate's camera faces the other way, so every crossing it ever reported was
# recorded as the exact opposite of what happened.
LTR = "ltr"      # arriving trucks travel left -> right
RTL = "rtl"      # arriving trucks travel right -> left


def centroid_x(box) -> float:
    """Horizontal centre of a box, in pixels."""
    return (box["x0"] + box["x1"]) / 2.0


def centroid_side(box, frame_width: float) -> str:
    """Which half of the frame a box's centroid sits in.

    Retained for the live overlay and for tests; direction no longer depends on
    it (see ``MIN_TRAVEL_FRACTION``). A box straddling the centre counts as
    RIGHT.
    """
    return LEFT if centroid_x(box) < frame_width / 2.0 else RIGHT


def travel_direction(
    positions: list[float], frame_width: float, inbound_axis: str = LTR
) -> str | None:
    """'inbound'/'outbound' from a centroid's path, or None if it barely moved.

    Pure so it can be tested against synthetic paths with no model or camera.
    """
    if len(positions) < 2 or frame_width <= 0:
        return None
    delta = positions[-1] - positions[0]
    if abs(delta) < MIN_TRAVEL_FRACTION * frame_width:
        return None
    rightward = delta > 0
    arriving = rightward if inbound_axis == LTR else not rightward
    return "inbound" if arriving else "outbound"


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

    def __init__(
        self,
        tunables: TunableStore,
        finalizer_queue: queue.Queue,
        inbound_axis: str = LTR,
    ) -> None:
        self._tunables = tunables
        self._queue = finalizer_queue
        self._inbound_axis = inbound_axis if inbound_axis in (LTR, RTL) else LTR
        self.state = IDLE
        self.window_start_ts: float | None = None
        self.last_qualifying_ts: float | None = None
        self.cooldown_until = 0.0
        self.reads: list[dict] = []
        self.last_ocr_box = None
        self.last_yolo_ts = 0.0
        self.last_ocr_ts = 0.0
        # One centroid x per qualifying frame this window has seen, in order,
        # plus the width of the frame they were measured in. Only the first and
        # last entries are ever read (see ``direction``), so a truck sitting
        # still costs nothing.
        self.positions: list[float] = []
        self.frame_width: float = 0.0

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

    def note_position(self, box, frame_width: float) -> None:
        """Record where along the frame the truck is.

        Called for every qualifying frame while the window is ACTIVE, not just
        the ones that trigger OCR -- direction needs the box's whole path
        through the frame, and OCR is throttled and deduped for a different
        reason (SRS §3.2 step 3) that would starve this of samples.
        """
        if self.state != ACTIVE or frame_width <= 0:
            return
        self.frame_width = frame_width
        self.positions.append(centroid_x(box))

    @property
    def direction(self) -> str | None:
        """'inbound', 'outbound', or None when the truck barely moved.

        Decided by net centroid travel and this device's ``inbound_axis``, so a
        lane framed entirely to one side of the frame centre still resolves --
        see ``travel_direction``. None stays a real third answer for a truck
        caught only at the very edge of a window: the induk records that
        crossing with no direction rather than inventing one, and shows it for
        review instead of silently filing it as a departure.
        """
        return travel_direction(self.positions, self.frame_width, self._inbound_axis)

    # -- state transitions ----------------------------------------------------

    def _open_window(self, now: float) -> None:
        self.state = ACTIVE
        self.window_start_ts = now
        self.last_qualifying_ts = now
        self.reads = []
        self.positions = []
        self.frame_width = 0.0
        self.last_ocr_box = None      # dedup reference always starts clean per window

    def _close_window(self, now: float) -> None:
        # Hand off and return immediately -- consensus and JPEG encoding must
        # never block frame capture (SRS §3.1 Window Finalizer).
        self._queue.put((self.window_start_ts, now, self.reads, self.direction))
        self.state = IDLE
        self.window_start_ts = None
        self.last_qualifying_ts = None
        self.reads = []
        self.positions = []
        self.frame_width = 0.0
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
