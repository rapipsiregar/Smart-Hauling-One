"""Inference loop: pull the newest frame, run YOLO, drive the state machine.

OCR no longer runs here. It used to -- inline, between one frame and the next --
and at ~0.5 s per crop that stalled capture for half a second at a time, which on
screen looks like the detector freezing every time it finds something. Crops now
go to ``agent/ocr_worker.OcrPool`` and their readings come back through a queue
that this thread drains, so YOLO keeps up with the camera and boxes reach the
gate's HUD without waiting for a reading
(docs/sample-references/enhancement.md).

The state machine stays single-threaded. ``DetectionWindow`` is transcribed from
SRS §3.2 and is not safe to touch from two threads; only this loop calls it.

Heavy imports are deferred so the rest of the agent imports fine on a machine
with no GPU stack.
"""

from __future__ import annotations

import os
import queue
import threading
import time
from collections.abc import Callable

from agent.config import DETECT_TRIGGER_CONF, Settings, TunableStore
from agent.live_state import LIVE
from agent.ocr_worker import OcrJob, OcrPool
from agent.pipeline import ACTIVE, DetectionWindow, encode_jpeg

# How long a finished window will wait for OCR still in flight before closing
# without it. Without a wait, a slow recogniser means every window closes with
# zero reads and the gate records UNKNOWN for every truck that passes. Without a
# cap, one wedged worker keeps a window open forever and no crossing is ever
# recorded. Both failures are silent, which is why this is bounded on both ends.
OCR_DRAIN_GRACE_SEC = 4.0

# The consensus/OCR helpers are shared with the batch pipeline and must never be
# forked (SRS §3.3, §10). vendor/ocr_utils.py is the byte-identical copy of the
# core's labs/custom_model/ocr_utils.py, verified by tests/test_vendor_sync.py.
from vendor.ocr_utils import normalize_hull_id, pad_crop, run_ocr_on_crop  # noqa: F401

from agent.annotate import annotated_jpeg


def resolve_device(requested: str | None = None) -> str:
    """Pick the inference device: what was asked for, if the machine has it.

    A Jetson has CUDA and this returns "cuda"; a dev box, or a device whose torch
    build turns out to be the CPU wheel, gets "cpu" instead of an
    ``AssertionError: Torch not compiled with CUDA enabled`` that kills the
    inference thread on its first frame. Slow detection is debuggable; a gate
    that reports itself healthy while detecting nothing is not.

    Override with SMART_GATE_DEVICE=cpu to force it either way.
    """
    requested = requested or os.environ.get("SMART_GATE_DEVICE") or "cuda"
    if not requested.startswith("cuda"):
        return requested
    try:
        import torch

        if torch.cuda.is_available():
            return requested
    except Exception:  # torch missing entirely -- CPU is the only honest answer
        pass
    print("inference: CUDA unavailable; falling back to CPU (detection will be slow)")
    return "cpu"


def build_ocr_pipeline(device: str = "cuda", backend: str | None = None):
    """Construct the OCR engine the shared helpers expect.

    Which engine is now a choice -- see agent/ocr_backends.py for the two and why
    the small one is the default on a Jetson behind Starlink. Whichever is built,
    it presents PaddleOCR-VL's call signature and result shape, because
    ``vendor/ocr_utils.run_ocr_on_crop`` is byte-identical to the core's copy
    (SRS §3.3) and cannot be taught about engines.

    Selecting ``paddleocr-vl`` reproduces exactly what
    ``app/services/analysis.py::_load_engines`` builds, so edge and batch OCR
    still behave identically when that is the engine chosen.
    """
    from agent import ocr_backends

    return ocr_backends.build(backend, device=device)


def _primary_box(boxes: list[dict]) -> dict:
    """The box that stands in for 'the truck' this frame, for direction tracking.

    Largest area, matching the single-track-per-window assumption the rest of
    this loop already makes (one ``_track_id`` per open window). Multiple boxes
    in the same frame are usually the same truck at different YOLO confidences
    or a partial second detection at the frame's edge, not two trucks sharing a
    lane -- the biggest box is the one most likely to be the whole vehicle.
    """
    return max(boxes, key=lambda b: (b["x1"] - b["x0"]) * (b["y1"] - b["y0"]))


class DummyYOLO:
    def predict(self, frame, conf=0.5, verbose=False):
        return []

class DummyOCR:
    def predict(self, crop, use_layout_detection=False, prompt_label="ocr"):
        return []

class InferenceLoop(threading.Thread):
    def __init__(
        self,
        ring,
        tunables: TunableStore,
        finalizer_queue: queue.Queue,
        settings: Settings,
        device: str | None = None,
        on_error: Callable[[str], None] | None = None,
    ) -> None:
        super().__init__(name="inference", daemon=True)
        self.ring = ring
        self.window = DetectionWindow(tunables, finalizer_queue)
        self.settings = settings
        # Resolved at construction, not import: it is the machine that decides.
        self.device = resolve_device(device)
        self.on_error = on_error
        self._stop = threading.Event()
        self._model = None
        self._ocr = None
        self._pool: OcrPool | None = None
        # One track per Detection Window, so a crop labelled T#7 C#3 on screen
        # can be traced to the exact vote it fed.
        self._track_id = 0
        self._crop_index = 0
        self._inflight: dict[int, int] = {}
        self._defer_since: float | None = None

    def stop(self) -> None:
        self._stop.set()
        if self._pool is not None:
            self._pool.stop()

    def _load_models(self) -> None:
        """Deferred import: ultralytics/paddleocr are the ``inference`` extra."""
        try:
            from ultralytics import YOLO
            if self.settings.model_path.exists():
                print(f"inference: loading model from {self.settings.model_path}")
                self._model = YOLO(str(self.settings.model_path))
            else:
                print(f"inference: model file {self.settings.model_path} not found; using fallback detector")
                self._model = DummyYOLO()
        except Exception as err:
            print(f"inference: ultralytics unavailable ({err}); using fallback detector")
            self._model = DummyYOLO()

        try:
            self._ocr = build_ocr_pipeline(self.device)
        except Exception as err:
            print(f"inference: paddleocr unavailable ({err}); using fallback OCR")
            self._ocr = DummyOCR()

        print("inference: models ready")

    def _detect(self, frame) -> list[dict]:
        """Run YOLO and normalise its output to plain dicts.

        ``conf=DETECT_TRIGGER_CONF`` is the model's own threshold, so the returned
        boxes already exclude anything below the window-trigger floor -- no
        separate filter step is needed (SRS §3.2 step 2).
        """
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

    # -- OCR handoff ----------------------------------------------------------

    def _drain_ocr(self) -> None:
        """Fold finished readings into the window, and onto the HUD.

        This runs on the detection thread, which is the whole point: the workers
        never touch ``DetectionWindow``, so the SRS §3.2 state machine stays
        single-threaded even though recognition is now concurrent.
        """
        if self._pool is None:
            return
        for result in self._pool.drain():
            job = result.job
            self._inflight[job.track_id] = max(0, self._inflight.get(job.track_id, 0) - 1)
            LIVE.add_crop(
                job.track_id,
                crop_index=job.crop_index,
                jpeg=result.crop_jpeg,
                text=result.text,
                raw=result.raw,
                ocr_conf=result.ocr_conf,
                det_conf=job.det_conf,
                frame=job.frame_index,
            )
            # A reading that landed after its window closed has nowhere to go.
            # It is still shown on the HUD above -- the sample was real -- but it
            # cannot join a vote that has already been counted.
            if result.text is None or job.track_id != self._track_id:
                continue
            if self.window.state != ACTIVE:
                continue
            self.window.record_read(
                text=result.text,
                # The exact weight formula the batch pipeline uses (SRS §3.2).
                weight=job.det_conf * (result.ocr_conf or 0.5),
                det_conf=job.det_conf,
                ocr_conf=result.ocr_conf or 0.0,
                # The crop's own timestamp, not now: a read belongs to the moment
                # the frame was taken, or a slow queue would stretch every window.
                now=job.ts,
                crop_jpeg=result.crop_jpeg,
            )
            self._publish_votes()

    def _publish_votes(self) -> None:
        """Push the vote as it currently stands, so the HUD shows it converging."""
        from vendor.ocr_utils import fuzzy_vote_distribution

        reads = [(r["text"], r["weight"]) for r in self.window.reads]
        if not reads:
            return
        voted, share, distribution = fuzzy_vote_distribution(reads)
        LIVE.update_votes(self._track_id, voted, share, distribution)

    def _end_frame(self, now: float) -> None:
        """Close the window, but not while its own OCR is still in flight.

        ``end_frame`` is what finalises a window, so deferring the call defers the
        close. With nothing in flight this is exactly the old behaviour.
        """
        pending = self._inflight.get(self._track_id, 0)
        if pending <= 0:
            self._defer_since = None
            if self.window.end_frame(now):
                LIVE.close_track(self._track_id)
            return
        if self._defer_since is None:
            self._defer_since = now
        elif now - self._defer_since >= OCR_DRAIN_GRACE_SEC:
            print(f"inference: closing T#{self._track_id} with {pending} crops "
                  f"still in OCR after {OCR_DRAIN_GRACE_SEC}s")
            self._inflight[self._track_id] = 0
            self._defer_since = None
            if self.window.end_frame(now):
                LIVE.close_track(self._track_id)

    def run(self) -> None:
        try:
            self._load_models()
        except Exception as err:
            # A dead detection thread is the one failure the gate must never hide:
            # every other thread keeps running, so without this the local API goes
            # on reporting a healthy agent that will never detect a truck.
            message = f"inference unavailable: {type(err).__name__}: {err}"
            print(f"inference: {message}")
            if self.on_error is not None:
                self.on_error(message)
            return

        self._pool = OcrPool(self._ocr)
        self._pool.start()

        last_seq = 0
        while not self._stop.is_set():
            seq, frame = self.ring.wait_for_new(last_seq, timeout=1.0)
            # Always first: a reading may be waiting even on a pass with no frame,
            # and a window that is timing out needs it before it closes.
            self._drain_ocr()
            if frame is None:
                self._end_frame(time.monotonic())
                continue
            last_seq = seq
            now = time.monotonic()

            if not self.window.should_run_yolo(now):
                continue

            was_idle = self.window.state != ACTIVE
            boxes = self._detect(frame)

            if was_idle and boxes:
                # A new truck. Open the track before begin_frame so the very first
                # frame of the window is already labelled with the right id.
                self._track_id += 1
                self._crop_index = 0
                LIVE.open_track(self._track_id)

            # Published before any OCR is even queued -- this is the change the
            # gate console exists to show: boxes appear the moment YOLO finds
            # them, and the reading catches up afterwards.
            track = self._track_id if boxes else None
            LIVE.publish_frame(
                annotated_jpeg(frame, boxes, detail=False),
                boxes,
                source="camera",
                # Only encoded while a viewer has Detail on -- a second JPEG per
                # frame is real money on a Jetson that also has to infer.
                detail_jpeg=(
                    annotated_jpeg(frame, boxes, track_id=track, detail=True)
                    if LIVE.detail_wanted() else None
                ),
            )

            if not self.window.begin_frame(bool(boxes), now):
                continue

            if boxes:
                self.window.note_position(_primary_box(boxes), frame.shape[1])

            # Every qualifying box is processed independently, matching the batch
            # pipeline's `for box in results.boxes` loop -- not just the best one.
            for box in boxes:
                if not self.window.wants_ocr(box, now):
                    continue
                self.window.note_ocr(box, now)
                crop = pad_crop(
                    frame, int(box["x0"]), int(box["y0"]), int(box["x1"]), int(box["y1"])
                )
                if crop.size == 0:
                    continue
                self._crop_index += 1
                queued = self._pool.submit(OcrJob(
                    track_id=self._track_id,
                    crop_index=self._crop_index,
                    # Copied: the ring reuses its buffers, and a worker reading
                    # this crop several frames later would otherwise see whatever
                    # the camera has written over it since.
                    crop=crop.copy(),
                    det_conf=box["conf"],
                    frame_index=seq,
                    ts=now,
                ))
                if queued:
                    self._inflight[self._track_id] = self._inflight.get(self._track_id, 0) + 1
                    LIVE.note_ocr_queued(self._track_id)

            self._end_frame(now)
