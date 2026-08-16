"""Detection Window state machine, driven by synthetic boxes.

No model, no camera -- this is the part of the agent that can be genuinely tested
without a Jetson.
"""

from __future__ import annotations

import queue

import pytest

from agent.config import Tunables, TunableStore
from agent.config import NO_DETECTION_GRACE_SEC, POST_WINDOW_COOLDOWN_SEC
from agent.pipeline import ACTIVE, IDLE, DetectionWindow, centroid_side, iou

# Derived from the constants rather than written as literals: the grace period
# is tuned against real footage (see agent/config.py), and a test that hardcodes
# today's value fails on a legitimate retune while proving nothing about the
# behaviour it is meant to guard -- that a window closes once the gap elapses.
GAP_CLOSES = 100.1 + NO_DETECTION_GRACE_SEC   # last detection at 100.1
AFTER_COOLDOWN = GAP_CLOSES + POST_WINDOW_COOLDOWN_SEC + 0.1


def _box(x0=0, y0=0, x1=100, y1=100, conf=0.9):
    return {"x0": x0, "y0": y0, "x1": x1, "y1": y1, "conf": conf}


@pytest.fixture
def window():
    """A window pinned to the left-to-right axis.

    Stated explicitly, not left to the default. The axis now follows the
    device's own SMART_GATE_INBOUND_AXIS -- which is right, because a gate
    provisioned as rtl must not silently run as ltr -- and that made these
    assertions depend on whichever .env happened to be loaded. A test about
    which way "left to right" reads has to name the axis it assumes, or it is
    testing the deployment rather than the behaviour.
    """
    store = TunableStore(Tunables(
        yolo_fps=20, ocr_fps=4, detect_window_sec=6, inbound_axis="ltr",
    ))
    return DetectionWindow(store, queue.Queue(), inbound_axis="ltr")


def test_iou_identical_boxes_is_one():
    assert iou((0, 0, 10, 10), (0, 0, 10, 10)) == pytest.approx(1.0)


def test_iou_disjoint_boxes_is_zero():
    assert iou((0, 0, 10, 10), (50, 50, 60, 60)) == 0.0


def test_starts_idle(window):
    assert window.state == IDLE


def test_detection_opens_a_window(window):
    window.begin_frame(True, now=100.0)
    assert window.state == ACTIVE
    assert window.window_start_ts == 100.0


def test_no_detection_leaves_it_idle(window):
    window.begin_frame(False, now=100.0)
    assert window.state == IDLE


def test_window_closes_on_duration_cap(window):
    window.begin_frame(True, now=100.0)
    window.last_qualifying_ts = 105.0
    assert window.end_frame(105.0) is False       # under the 6s cap
    window.last_qualifying_ts = 106.0             # still seeing the truck
    assert window.end_frame(106.0) is True        # cap reached
    assert window.state == IDLE


def test_window_closes_on_detection_gap(window):
    window.begin_frame(True, now=100.0)
    # The grace period has elapsed: the truck has left the frame.
    assert window.end_frame(GAP_CLOSES) is True
    assert window.state == IDLE


def test_cooldown_suppresses_immediate_retrigger(window):
    window.begin_frame(True, now=100.0)
    window.end_frame(GAP_CLOSES)
    # A trailing-edge detection right after close must not open a second window
    # for the same physical truck (SRS §3.2).
    window.begin_frame(True, now=GAP_CLOSES + 0.1)
    assert window.state == IDLE
    # Once the cooldown has passed, a genuinely new truck can open one.
    window.begin_frame(True, now=AFTER_COOLDOWN)
    assert window.state == ACTIVE


def test_closed_window_is_handed_to_the_finalizer(window):
    window.begin_frame(True, now=100.0)
    window.record_read(
        text="DT-118", weight=0.8, det_conf=0.9, ocr_conf=0.89,
        now=100.5, crop_jpeg=b"x",
    )
    window.end_frame(GAP_CLOSES)
    start, end, reads, direction = window._queue.get_nowait()
    assert start == 100.0 and end == GAP_CLOSES
    assert len(reads) == 1 and reads[0]["text"] == "DT-118"
    assert direction is None


def test_yolo_fps_throttle(window):
    assert window.should_run_yolo(100.0) is True
    assert window.should_run_yolo(100.01) is False   # 20fps -> 50ms apart
    assert window.should_run_yolo(100.06) is True


def test_ocr_gated_by_confidence(window):
    window.begin_frame(True, now=100.0)
    assert window.wants_ocr(_box(conf=0.2), now=100.0) is False   # below ocr_min_conf
    assert window.wants_ocr(_box(conf=0.9), now=100.0) is True


def test_ocr_gated_by_area(window):
    window.begin_frame(True, now=100.0)
    # 10x10 = 100 px^2, under OCR_MIN_AREA 400.
    assert window.wants_ocr(_box(x1=10, y1=10), now=100.0) is False


def test_ocr_deduplicated_by_iou(window):
    window.begin_frame(True, now=100.0)
    box = _box()
    assert window.wants_ocr(box, now=100.0) is True
    window.note_ocr(box, now=100.0)
    # A near-identical box 1s later: same plate, hasn't moved -> skip.
    assert window.wants_ocr(_box(x0=1, y0=1, x1=101, y1=101), now=101.0) is False
    # A clearly different position -> OCR it.
    assert window.wants_ocr(_box(x0=500, y0=500, x1=700, y1=700), now=101.0) is True


def test_ocr_fps_throttle(window):
    window.begin_frame(True, now=100.0)
    box = _box()
    assert window.wants_ocr(box, now=100.0) is True
    window.note_ocr(box, now=100.0)
    far = _box(x0=500, y0=500, x1=700, y1=700)
    assert window.wants_ocr(far, now=100.1) is False   # 4fps -> 250ms apart
    assert window.wants_ocr(far, now=100.3) is True


def test_dedup_reference_resets_between_windows(window):
    window.begin_frame(True, now=100.0)
    box = _box()
    window.note_ocr(box, now=100.0)
    window.end_frame(GAP_CLOSES)
    # New truck, same position in frame: must not be suppressed by the previous
    # window's dedup reference (SRS §3.2 -- "always starts clean per window").
    window.begin_frame(True, now=AFTER_COOLDOWN)
    assert window.wants_ocr(box, now=AFTER_COOLDOWN) is True


# --- direction: the virtual center line ---------------------------------------
# Every gate now judges inbound/outbound from a truck's own path through the
# frame instead of a fixed per-gate setting. FRAME_W/2 is the line; a truck
# whose centroid starts left of it and ends right of it is inbound, and the
# mirror image is outbound.

FRAME_W = 1000


def test_centroid_side_left_and_right():
    assert centroid_side(_box(x0=0, x1=100), FRAME_W) == "left"       # cx=50
    assert centroid_side(_box(x0=900, x1=1000), FRAME_W) == "right"   # cx=950


def test_centroid_exactly_on_the_line_is_right():
    assert centroid_side(_box(x0=400, x1=600), FRAME_W) == "right"    # cx=500


def test_left_to_right_is_inbound(window):
    window.begin_frame(True, now=100.0)
    window.note_position(_box(x0=0, x1=100), FRAME_W)          # left
    window.note_position(_box(x0=850, x1=950), FRAME_W)        # right
    assert window.direction == "inbound"


def test_right_to_left_is_outbound(window):
    window.begin_frame(True, now=100.0)
    window.note_position(_box(x0=850, x1=950), FRAME_W)        # right
    window.note_position(_box(x0=0, x1=100), FRAME_W)          # left
    assert window.direction == "outbound"


def test_staying_on_one_side_has_no_direction(window):
    """Seen, but never crossed the line -- a real 'unknown', not a guess."""
    window.begin_frame(True, now=100.0)
    window.note_position(_box(x0=0, x1=100), FRAME_W)
    window.note_position(_box(x0=50, x1=150), FRAME_W)
    assert window.direction is None


def test_a_single_qualifying_frame_has_no_direction(window):
    window.begin_frame(True, now=100.0)
    window.note_position(_box(x0=0, x1=100), FRAME_W)
    assert window.direction is None


def test_no_frames_at_all_has_no_direction(window):
    window.begin_frame(True, now=100.0)
    assert window.direction is None


def test_position_is_ignored_while_idle(window):
    """A box seen before a window opens must not seed the next one's trajectory."""
    window.note_position(_box(x0=0, x1=100), FRAME_W)
    assert window.direction is None


def test_direction_is_handed_to_the_finalizer_with_the_window(window):
    window.begin_frame(True, now=100.0)
    window.note_position(_box(x0=0, x1=100), FRAME_W)
    window.note_position(_box(x0=900, x1=1000), FRAME_W)
    window.end_frame(GAP_CLOSES)
    *_, direction = window._queue.get_nowait()
    assert direction == "inbound"


def test_direction_resets_between_windows(window):
    """A truck that went inbound must not leave a stale answer for the next one."""
    window.begin_frame(True, now=100.0)
    window.note_position(_box(x0=0, x1=100), FRAME_W)
    window.note_position(_box(x0=900, x1=1000), FRAME_W)
    window.end_frame(GAP_CLOSES)

    window.begin_frame(True, now=AFTER_COOLDOWN)
    assert window.direction is None
