# Section 10 — Detection Window State Machine & Consensus

**Goal:** the agent turns a live camera stream into one consensus-voted hull ID per truck.
**Depends on:** [09](./09-edge-agent-scaffold.md). **Blocks:** 11.

This is the heart of the edge agent. `docs/edge-system/SRS.md` §3.2 gives the state machine as
near-real Python; **transcribe it, don't reinterpret it**. §3.3 and §3.4 give consensus and snapshot
selection.

---

## 10.1 [DONE] `edge/agent/pipeline.py` — the state machine

```python
"""Detection Window state machine (docs/edge-system/SRS.md §3.2).

One truck passing the gate == one Detection Window == one crossing event. The
window opens on the first qualifying YOLO box and closes on either the duration
cap or a grace period with no detections.

Transcribed from SRS §3.2's algorithm. If you change the logic here, change the
spec first -- this file is not the place to improvise.
"""

from __future__ import annotations

import queue
import threading
import time

import cv2

from agent.config import (
    DETECT_TRIGGER_CONF,
    NO_DETECTION_GRACE_SEC,
    OCR_MIN_AREA,
    POST_WINDOW_COOLDOWN_SEC,
    TunableStore,
)

IDLE = "IDLE"
ACTIVE = "ACTIVE"


def iou(box_a, box_b) -> float:
    """Intersection-over-union of two (x0, y0, x1, y1) boxes."""
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

    # -- helpers the inference loop injects, so this class stays testable ------

    def should_run_yolo(self, now: float) -> bool:
        """yolo_fps throttle -- skip this frame if we are ahead of schedule."""
        config = self._tunables.get()
        if now - self.last_yolo_ts < 1.0 / max(1, config.yolo_fps):
            return False
        self.last_yolo_ts = now
        return True

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

    def wants_ocr(self, box, now: float) -> bool:
        """The four gates from SRS §3.2 step 3, in order."""
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

    def record_read(self, *, text: str, weight: float, det_conf: float,
                    ocr_conf: float, now: float, crop_jpeg: bytes) -> None:
        self.reads.append({
            "text": text, "weight": weight, "det_conf": det_conf,
            "ocr_conf": ocr_conf, "ts": now, "crop_jpeg": crop_jpeg,
        })

    def note_ocr(self, box, now: float) -> None:
        self.last_ocr_ts = now
        self.last_ocr_box = (box["x0"], box["y0"], box["x1"], box["y1"])

    # -- the state transitions ------------------------------------------------

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
        """Close the window if either condition is met. Returns True if closed."""
        if self.state != ACTIVE or self.window_start_ts is None:
            return False
        config = self._tunables.get()
        duration = now - self.window_start_ts
        gap = now - (self.last_qualifying_ts or self.window_start_ts)
        if duration >= config.detect_window_sec or gap >= NO_DETECTION_GRACE_SEC:
            self._close_window(now)
            return True
        return False
```

> **Why `DETECT_TRIGGER_CONF` looks unused here:** it is passed to YOLO as its own `conf=` threshold
> in the inference loop (10.2), so `boxes` already excludes anything below it — no separate filter.
> If an operator sets `ocr_min_conf` *below* 0.30, the `box["conf"] < config.ocr_min_conf` check
> becomes a no-op, because the trigger threshold is the effective floor. SRS §3.2 calls this out
> as expected, not a bug.

---

## 10.2 [DONE] `edge/agent/inference.py` — the loop that drives it

```python
"""Inference loop: pull the newest frame, run YOLO+OCR, drive the state machine.

YOLO and OCR run sequentially per frame, matching the batch pipeline's structure
(labs/custom_model/video_processor.py). Heavy imports are deferred so the rest of
the agent can be imported and unit-tested on a machine with no GPU stack.
"""

from __future__ import annotations

import queue
import sys
import threading
import time
from pathlib import Path

from agent.config import DETECT_TRIGGER_CONF, Settings, TunableStore
from agent.pipeline import DetectionWindow, encode_jpeg

# The consensus functions are shared with the batch pipeline and must never be
# forked or reimplemented (SRS §3.3, §10). labs/ sits two levels up from
# edge/agent/, matching how app/core/config.py locates the same directory.
_LABS_DIR = Path(__file__).resolve().parents[2] / "labs"
if str(_LABS_DIR) not in sys.path:
    sys.path.append(str(_LABS_DIR))

from custom_model.ocr_utils import (  # noqa: E402
    normalize_hull_id,
    pad_crop,
    run_ocr_on_crop,
)


class InferenceLoop(threading.Thread):
    def __init__(
        self, ring, tunables: TunableStore, finalizer_queue: queue.Queue, settings: Settings
    ) -> None:
        super().__init__(name="inference", daemon=True)
        self.ring = ring
        self.window = DetectionWindow(tunables, finalizer_queue)
        self.settings = settings
        self._stop = threading.Event()
        self._model = None
        self._ocr = None

    def stop(self) -> None:
        self._stop.set()

    def _load_models(self) -> None:
        """Deferred import: ultralytics/paddleocr are the `inference` extra."""
        from ultralytics import YOLO

        self._model = YOLO(str(self.settings.model_path))
        from custom_model.ocr_utils import build_ocr_pipeline  # if provided
        self._ocr = build_ocr_pipeline()

    def _detect(self, frame) -> list[dict]:
        """Run YOLO and normalise its output to plain dicts."""
        results = self._model.predict(frame, conf=DETECT_TRIGGER_CONF, verbose=False)
        boxes = []
        for result in results:
            for box in getattr(result, "boxes", []):
                x0, y0, x1, y1 = (float(v) for v in box.xyxy[0].tolist())
                boxes.append({
                    "x0": x0, "y0": y0, "x1": x1, "y1": y1,
                    "conf": float(box.conf[0]),
                })
        return boxes

    def run(self) -> None:
        self._load_models()
        last_seq = 0
        while not self._stop.is_set():
            seq, frame = self.ring.wait_for_new(last_seq, timeout=1.0)
            if frame is None:
                # No new frame; still let an open window time out.
                self.window.end_frame(time.monotonic())
                continue
            last_seq = seq
            now = time.monotonic()

            if not self.window.should_run_yolo(now):
                continue

            boxes = self._detect(frame)
            if not self.window.begin_frame(bool(boxes), now):
                continue

            # Every qualifying box is processed independently, matching the batch
            # pipeline's `for box in results.boxes` loop -- not just the best one.
            for box in boxes:
                if not self.window.wants_ocr(box, now):
                    continue
                self.window.note_ocr(box, now)
                crop = pad_crop(
                    frame, int(box["x0"]), int(box["y0"]), int(box["x1"]), int(box["y1"])
                )
                text, ocr_conf = run_ocr_on_crop(crop, self._ocr)
                if not text:
                    continue
                normalized = normalize_hull_id(text)
                if normalized == "UNKNOWN":
                    continue
                self.window.record_read(
                    text=normalized,
                    # The exact weight formula the batch pipeline uses (SRS §3.2).
                    weight=box["conf"] * (ocr_conf or 0.5),
                    det_conf=box["conf"],
                    ocr_conf=ocr_conf or 0.0,
                    now=now,
                    crop_jpeg=encode_jpeg(crop),
                )

            self.window.end_frame(now)
```

> **`build_ocr_pipeline` may not exist** in `labs/custom_model/ocr_utils.py`. Check before writing
> this: `grep -n "^def " labs/custom_model/ocr_utils.py`. The confirmed exports are
> `extract_text_from_ocr_result`, `pad_crop`, `run_ocr_on_crop`, `normalize_hull_id`,
> `_levenshtein`, `fuzzy_vote`, `fuzzy_vote_distribution`. If there is no pipeline builder, look at
> how `labs/custom_model/video_processor.py` constructs the PaddleOCR object and mirror that
> construction here — **in this file**, not by adding a function to `ocr_utils.py`.

---

## 10.3 [DONE] `edge/agent/consensus.py` — the window finalizer

```python
"""Window finalizer: consensus vote + best snapshot (SRS §3.3, §3.4).

The voting math is NOT reimplemented here. fuzzy_vote_distribution is the same
function the batch pipeline calls, so both pipelines agree bit-for-bit -- that is
an explicit success criterion in docs/edge-system/PRD.md §6.
"""

from __future__ import annotations

import sys
from pathlib import Path

_LABS_DIR = Path(__file__).resolve().parents[2] / "labs"
if str(_LABS_DIR) not in sys.path:
    sys.path.append(str(_LABS_DIR))

from custom_model.ocr_utils import _levenshtein, fuzzy_vote_distribution  # noqa: E402


def avg_ocr_conf_per_cluster(reads: list[dict], distribution: list[dict]) -> dict:
    """Mean OCR confidence per consensus cluster (SRS §3.3 step 3).

    fuzzy_vote_distribution does not expose cluster membership, so reads are
    re-associated by nearest representative. This is an approximation: two
    equidistant clusters can attract a read the original clustering placed
    elsewhere. It only ever affects this diagnostic field -- never the winning
    hull_id, which comes straight from the shared function. Accepted in SRS §11
    rather than modifying the shared clustering code.
    """
    if not distribution:
        return {}
    groups: dict[str, list[float]] = {d["id"]: [] for d in distribution}
    for read in reads:
        closest = min(distribution, key=lambda d: _levenshtein(read["text"], d["id"]))
        groups[closest["id"]].append(read.get("ocr_conf") or 0.0)
    return {
        cluster_id: (sum(values) / len(values) if values else 0.0)
        for cluster_id, values in groups.items()
    }


def pick_best_snapshot(reads: list[dict], distribution: list[dict], hull_id: str) -> bytes | None:
    """Highest-weight read in the winning cluster; ties break to the latest.

    A later frame is more likely to be squarely framed and less motion-blurred as
    the truck aligns with the camera (SRS §3.4).
    """
    if not reads or not distribution:
        return None
    winners = [
        r for r in reads
        if min(distribution, key=lambda d: _levenshtein(r["text"], d["id"]))["id"] == hull_id
    ]
    if not winners:
        winners = reads
    best = max(winners, key=lambda r: (r["weight"], r["ts"]))
    return best.get("crop_jpeg")


def finalize_window(window_start_ts: float, window_end_ts: float, reads: list[dict]) -> dict:
    """Turn a closed window's reads into a submittable crossing result.

    An empty window still produces a crossing (SRS §3.3 step 1): operators must
    see that a truck crossed even when it could not be identified. That mirrors
    the induk's own UNIDENTIFIED_HULLS sentinel handling.
    """
    duration = max(0.0, window_end_ts - window_start_ts)

    if not reads:
        return {
            "hull_id": "UNKNOWN",
            "confidence": 0.0,
            "read_count": 0,
            "votes": [],
            "window_sec": duration,
            "snapshot": None,
        }

    hull_id, confidence, distribution = fuzzy_vote_distribution(
        [(r["text"], r["weight"]) for r in reads]
    )
    per_cluster = avg_ocr_conf_per_cluster(reads, distribution)
    votes = [
        {
            "text": cluster["id"],
            "count": cluster["reads"],
            "avg_ocr_conf": round(per_cluster.get(cluster["id"], 0.0), 4),
        }
        for cluster in distribution
    ]
    return {
        "hull_id": hull_id,
        "confidence": confidence,
        "read_count": len(reads),
        "votes": votes,
        "window_sec": duration,
        "snapshot": pick_best_snapshot(reads, distribution, hull_id),
    }
```

---

## 10.4 [DONE] Unit-test the state machine with synthetic detections

No model, no camera — this is the only part of the agent that can be properly tested here.

**`edge/tests/test_pipeline.py`:**

```python
"""Detection Window state machine, driven by synthetic boxes."""

from __future__ import annotations

import queue

import pytest

from agent.config import Tunables, TunableStore
from agent.pipeline import ACTIVE, IDLE, DetectionWindow, iou


def _box(x0=0, y0=0, x1=100, y1=100, conf=0.9):
    return {"x0": x0, "y0": y0, "x1": x1, "y1": y1, "conf": conf}


@pytest.fixture
def window():
    store = TunableStore(Tunables(yolo_fps=20, ocr_fps=4, detect_window_sec=6))
    return DetectionWindow(store, queue.Queue())


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
    assert window.end_frame(105.0) is False       # under the 6s cap
    window.last_qualifying_ts = 106.0             # still seeing the truck
    assert window.end_frame(106.0) is True        # cap reached
    assert window.state == IDLE


def test_window_closes_on_detection_gap(window):
    window.begin_frame(True, now=100.0)
    # 1.5s grace: the truck has left the frame.
    assert window.end_frame(101.6) is True
    assert window.state == IDLE


def test_cooldown_suppresses_immediate_retrigger(window):
    window.begin_frame(True, now=100.0)
    window.end_frame(101.6)
    # A trailing-edge detection right after close must not open a second window
    # for the same physical truck (SRS §3.2).
    window.begin_frame(True, now=101.7)
    assert window.state == IDLE
    # After the 1s cooldown, a genuinely new truck can open one.
    window.begin_frame(True, now=103.0)
    assert window.state == ACTIVE


def test_closed_window_is_handed_to_the_finalizer(window):
    window.begin_frame(True, now=100.0)
    window.record_read(
        text="DT-118", weight=0.8, det_conf=0.9, ocr_conf=0.89,
        now=100.5, crop_jpeg=b"x",
    )
    window.end_frame(101.6)
    start, end, reads = window._queue.get_nowait()
    assert start == 100.0 and end == 101.6
    assert len(reads) == 1 and reads[0]["text"] == "DT-118"


def test_yolo_fps_throttle(window):
    assert window.should_run_yolo(100.0) is True
    assert window.should_run_yolo(100.01) is False   # 20fps -> 50ms apart
    assert window.should_run_yolo(100.06) is True


def test_ocr_gated_by_confidence(window):
    window.begin_frame(True, now=100.0)
    assert window.wants_ocr(_box(conf=0.2), now=100.0) is False   # below ocr_min_conf 0.30
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
    window.end_frame(101.6)
    # New truck, same position in frame: must not be suppressed by the previous
    # window's dedup reference (SRS §3.2 -- "always starts clean per window").
    window.begin_frame(True, now=103.0)
    assert window.wants_ocr(box, now=103.0) is True
```

---

## Acceptance for Section 10

- [ ] `cd edge && uv run pytest tests/ -q` passes — every state-machine test above.
- [ ] `grep -c "" agent/pipeline.py` is under 400.
- [ ] `labs/custom_model/ocr_utils.py` is **unmodified**: `git diff --stat labs/` is empty.
