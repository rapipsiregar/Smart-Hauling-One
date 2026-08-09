"""OCR off the detection thread.

Until now ``InferenceLoop.run`` called ``run_ocr_on_crop`` inline, between
reading a frame and reading the next one. With a recogniser at ~0.5 s per crop
that stalls capture for half a second at a time: boxes freeze on screen, frames
are missed, and the window's own clock keeps running while nothing is watched.
The reviewer's note (docs/sample-references/enhancement.md, "banyak pake
asynchronous process ya, biar nggak blocking") is describing exactly that.

So OCR moves here, behind a bounded queue, and the detection thread never blocks
on it.

Two rules make this safe:

**Results go back to the detection thread, never straight into the window.**
``DetectionWindow`` is a single-threaded state machine (SRS §3.2). A worker
calling ``record_read`` while the loop is in ``end_frame`` would corrupt a vote
in a way that shows up as a wrong hull id weeks later. Workers put finished
reads on a result queue; the loop drains it, and it alone touches the window.

**The queue is bounded and drops rather than grows.** If OCR cannot keep up, the
backlog must not. A dropped crop costs one sample out of a window that collects
many; an unbounded queue costs the device, and it would hand the window reads
from a truck that left thirty seconds ago. Drops are counted, not hidden -- a
gate quietly discarding most of its samples is something the HUD has to show.
"""

from __future__ import annotations

import queue
import threading
from dataclasses import dataclass, field

# Deep enough to ride out a slow crop or two, shallow enough that a queued crop
# still belongs to the truck currently in frame.
DEFAULT_QUEUE_SIZE = 6


@dataclass
class OcrJob:
    """One crop awaiting recognition, with everything needed to place the answer."""

    track_id: int
    crop_index: int
    crop: object                 # numpy BGR array
    det_conf: float
    frame_index: int
    ts: float
    box: tuple = field(default=())


@dataclass
class OcrResult:
    """What the recogniser made of one crop. ``text`` is None when it read nothing."""

    job: OcrJob
    text: str | None
    raw: str | None
    ocr_conf: float
    crop_jpeg: bytes


class OcrPool:
    """A small pool of threads turning crops into readings.

    One worker by default. The engines are not thread-safe in any documented way
    and a Jetson has one GPU, so a second worker would contend for the same
    device rather than double the throughput -- but the pool takes a count so a
    multi-core CPU running the tiny recogniser can use it.
    """

    def __init__(
        self,
        pipeline,
        *,
        workers: int = 1,
        queue_size: int = DEFAULT_QUEUE_SIZE,
        on_result=None,
    ) -> None:
        self._pipeline = pipeline
        self._jobs: queue.Queue[OcrJob | None] = queue.Queue(maxsize=queue_size)
        self._results: queue.Queue[OcrResult] = queue.Queue()
        self._on_result = on_result
        self._stop = threading.Event()
        self._dropped = 0
        self._lock = threading.Lock()
        self._threads = [
            threading.Thread(target=self._run, name=f"ocr-worker-{i}", daemon=True)
            for i in range(max(1, workers))
        ]

    def start(self) -> None:
        for thread in self._threads:
            thread.start()

    def stop(self) -> None:
        self._stop.set()
        for _ in self._threads:
            try:
                self._jobs.put_nowait(None)
            except queue.Full:
                pass

    def is_alive(self) -> bool:
        return any(t.is_alive() for t in self._threads)

    # -- producer side --------------------------------------------------------

    def submit(self, job: OcrJob) -> bool:
        """Queue a crop. False means the queue was full and the crop was dropped.

        Never blocks: the caller is the detection thread, and making it wait here
        would reintroduce the stall this module exists to remove.
        """
        try:
            self._jobs.put_nowait(job)
            return True
        except queue.Full:
            with self._lock:
                self._dropped += 1
            return False

    def dropped(self) -> int:
        with self._lock:
            return self._dropped

    def depth(self) -> int:
        return self._jobs.qsize()

    # -- consumer side --------------------------------------------------------

    def drain(self, limit: int = 16) -> list[OcrResult]:
        """Collect finished readings. Called by the detection thread each pass."""
        out = []
        for _ in range(limit):
            try:
                out.append(self._results.get_nowait())
            except queue.Empty:
                break
        return out

    # -- worker ---------------------------------------------------------------

    def _run(self) -> None:
        from agent.pipeline import encode_jpeg
        from vendor.ocr_utils import normalize_hull_id, run_ocr_on_crop

        while not self._stop.is_set():
            try:
                job = self._jobs.get(timeout=0.5)
            except queue.Empty:
                continue
            if job is None:
                return
            try:
                text, ocr_conf = run_ocr_on_crop(job.crop, self._pipeline)
                normalized = normalize_hull_id(text) if text else "UNKNOWN"
                result = OcrResult(
                    job=job,
                    text=None if normalized == "UNKNOWN" else normalized,
                    raw=text or None,
                    ocr_conf=ocr_conf or 0.0,
                    crop_jpeg=encode_jpeg(job.crop),
                )
            except Exception as err:
                # A recogniser that throws on one odd crop must not take the pool
                # down with it -- the window simply gets one fewer sample.
                print(f"ocr-worker: {type(err).__name__}: {err}")
                result = OcrResult(job=job, text=None, raw=None, ocr_conf=0.0,
                                   crop_jpeg=b"")
            self._results.put(result)
            if self._on_result is not None:
                try:
                    self._on_result(result)
                except Exception as err:
                    print(f"ocr-worker: on_result failed: {err}")
