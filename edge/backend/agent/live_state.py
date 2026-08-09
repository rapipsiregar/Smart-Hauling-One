"""What the gate is seeing right now, for the local inspection HUD.

Detection and OCR run at different speeds -- YOLO clears a frame in tens of
milliseconds, a recogniser takes hundreds. The whole point of this module is to
let the screen show the fast thing without waiting for the slow one: boxes and
frames land here the instant YOLO produces them, and each OCR sample is attached
to its track later, whenever it finishes
(docs/sample-references/enhancement.md: "Bounding box hasil deteksi truck number
ditampilkan (tidak perlu menunggu proses OCR)").

Scope: this device, this screen. The annotated frames produced here are served
only to the gate's own console over the LAN. The feed that reaches the centre
stays raw and unoverlaid -- that is agent/live_view.py, and PRD Goal 7's
non-goal still holds for it. Drawing boxes on the evidentiary stream, or pushing
these frames over the Starlink link, is not what this is for.

Everything is bounded. A gate runs for months without a restart, so an unbounded
buffer of crops is a memory leak with a long fuse.
"""

from __future__ import annotations

import threading
import time
import uuid
from collections import OrderedDict

# How many finished/active tracks stay addressable, and how many OCR samples we
# keep per track. Eight tracks is several trucks' worth of history on screen;
# twenty-four crops is more than a 6 s window at ocr_fps 4 can produce.
MAX_TRACKS = 8
MAX_CROPS_PER_TRACK = 24


class LiveState:
    """Thread-safe snapshot of frames, boxes, and per-track OCR samples.

    Written by the capture/inference threads, read by request handlers. Every
    method takes the lock and returns plain data -- a handler never holds a
    reference into a structure another thread is mutating.
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()
        # Identifies this process's run of the bus, and it earns its keep.
        #
        # Crop URLs are keyed by (track_id, crop_index) and cached hard by the
        # browser, because within one session a crop never changes. But track ids
        # restart from the same number every time the process does, so after a
        # restart those keys point at different images -- and the console shows
        # the previous session's photograph beside the current reading. Putting
        # this in the URL moves the cache key, without giving up the caching.
        self._session = uuid.uuid4().hex[:8]
        # The frame as an operator normally sees it: green boxes, no captions.
        self._frame_jpeg: bytes | None = None
        # The same frame with the track id and detection score drawn on. Encoded
        # only while somebody is watching with Detail on, because a second JPEG
        # per frame is real money on a device whose budget is inference -- and
        # the detailed view is the exception, not the norm.
        self._detail_jpeg: bytes | None = None
        self._detail_viewers = 0
        self._frame_seq = 0
        self._frame_ts = 0.0
        self._boxes: list[dict] = []
        self._tracks: OrderedDict[int, dict] = OrderedDict()
        self._active_track: int | None = None
        self._source: str | None = None
        # Bumped whenever a reader would see something new, so the HUD can poll
        # cheaply and the MJPEG stream can skip re-sending an identical frame.
        self._version = 0
        self._counters = {"frames": 0, "detections": 0, "ocr_attempts": 0, "ocr_reads": 0}

    # -- frames ---------------------------------------------------------------

    def publish_frame(
        self,
        jpeg: bytes,
        boxes: list[dict],
        source: str | None = None,
        detail_jpeg: bytes | None = None,
    ) -> None:
        """The newest frame and the boxes drawn on it.

        Called from the detection thread on every processed frame, including
        frames with no boxes: a lane with nothing in it is still the camera
        working, and a HUD that only updates when a truck is present looks frozen
        between trucks.

        ``jpeg`` carries the plain view -- boxes, no captions -- because that is
        what the console shows by default. ``detail_jpeg`` is the same frame with
        the track id and score drawn on, and is optional: producers ask
        :meth:`detail_wanted` first and pass None when nobody is watching that
        way, so the extra encode is only paid for when someone is looking.
        """
        with self._lock:
            self._frame_jpeg = jpeg
            self._detail_jpeg = detail_jpeg
            self._frame_seq += 1
            self._frame_ts = time.time()
            self._boxes = boxes
            if source is not None:
                self._source = source
            self._counters["frames"] += 1
            self._counters["detections"] += len(boxes)
            self._version += 1

    def latest_frame(self, *, detail: bool = False) -> tuple[int, bytes | None]:
        """The newest frame, with or without the diagnostic captions.

        Falls back to the plain frame when the detailed one was not encoded:
        showing the picture without captions beats showing nothing, and the
        viewer's next frame will carry them now that :meth:`detail_wanted` has
        been true for a tick.
        """
        with self._lock:
            if detail:
                return self._frame_seq, (self._detail_jpeg or self._frame_jpeg)
            return self._frame_seq, self._frame_jpeg

    def detail_wanted(self) -> bool:
        """Whether any viewer currently has Detail switched on."""
        with self._lock:
            return self._detail_viewers > 0

    def add_detail_viewer(self, delta: int) -> None:
        with self._lock:
            self._detail_viewers = max(0, self._detail_viewers + delta)

    def wait_for_frame(self, since_seq: int, timeout: float = 1.0) -> tuple[int, bytes | None]:
        """Block briefly for a frame newer than ``since_seq``.

        Polled rather than condition-signalled: the producer is a tight inference
        loop that must never be slowed down by bookkeeping for a viewer that may
        not exist. A 20 ms poll caps the stream near 50 fps, well above what the
        detector produces.
        """
        deadline = time.time() + timeout
        while True:
            with self._lock:
                if self._frame_seq != since_seq:
                    return self._frame_seq, self._frame_jpeg
            if time.time() >= deadline:
                return since_seq, None
            time.sleep(0.02)

    # -- tracks ---------------------------------------------------------------

    def open_track(self, track_id: int) -> None:
        """A Detection Window opened: one truck, one track, from now on.

        The track id IS the window id. The sample UI labels its crops ``T#<id>
        C#<n>``, and tying that label to the window means a crop on screen can be
        traced to exactly the vote it fed.
        """
        with self._lock:
            self._tracks[track_id] = {
                "track_id": track_id,
                "status": "scanning",
                "started_at": time.time(),
                "crops": [],
                "votes": [],
                "voted": None,
                "confidence": None,
                "hull_id": None,
                "outcome": None,
                "pending_ocr": 0,
            }
            self._active_track = track_id
            while len(self._tracks) > MAX_TRACKS:
                self._tracks.popitem(last=False)
            self._version += 1

    def note_ocr_queued(self, track_id: int) -> None:
        with self._lock:
            track = self._tracks.get(track_id)
            if track is not None:
                track["pending_ocr"] += 1
            self._counters["ocr_attempts"] += 1
            self._version += 1

    def add_crop(
        self,
        track_id: int,
        *,
        crop_index: int,
        jpeg: bytes,
        text: str | None,
        raw: str | None,
        ocr_conf: float,
        det_conf: float,
        frame: int,
    ) -> None:
        """One OCR sample, attached to its track once the recogniser answered.

        Samples that read nothing are kept. An attempt that failed is still the
        device working, and a strip showing only successes makes a clip of
        unreadable plates look like a stalled run.
        """
        with self._lock:
            track = self._tracks.get(track_id)
            if track is None:
                return
            track["crops"].append({
                "crop_index": crop_index,
                "text": text,
                "raw": raw,
                "ocr_conf": round(ocr_conf, 3),
                "det_conf": round(det_conf, 3),
                "frame": frame,
                "jpeg": jpeg,
            })
            if len(track["crops"]) > MAX_CROPS_PER_TRACK:
                track["crops"].pop(0)
            track["pending_ocr"] = max(0, track["pending_ocr"] - 1)
            self._counters["ocr_reads"] += 1 if text else 0
            self._version += 1

    def update_votes(self, track_id: int, voted: str | None, confidence: float | None,
                     votes: list[dict]) -> None:
        with self._lock:
            track = self._tracks.get(track_id)
            if track is not None:
                track["voted"] = voted
                track["confidence"] = confidence
                track["votes"] = votes
                self._version += 1

    def close_track(self, track_id: int, *, hull_id: str | None = None,
                    outcome: str | None = None, confidence: float | None = None) -> None:
        with self._lock:
            track = self._tracks.get(track_id)
            if track is not None:
                track["status"] = "done"
                track["hull_id"] = hull_id
                track["outcome"] = outcome
                if confidence is not None:
                    track["confidence"] = confidence
            if self._active_track == track_id:
                self._active_track = None
            self._version += 1

    def pending_ocr(self, track_id: int) -> int:
        with self._lock:
            track = self._tracks.get(track_id)
            return track["pending_ocr"] if track else 0

    def crop_jpeg(self, track_id: int, crop_index: int) -> bytes | None:
        with self._lock:
            track = self._tracks.get(track_id)
            if track is None:
                return None
            for crop in track["crops"]:
                if crop["crop_index"] == crop_index:
                    return crop["jpeg"]
            return None

    # -- reading --------------------------------------------------------------

    def snapshot(self) -> dict:
        """Everything the HUD needs, minus the image bytes.

        The JPEGs are deliberately left out and fetched by URL instead. Inlining
        them as base64 would put a megabyte of images into every poll of a screen
        that refreshes several times a second.
        """
        with self._lock:
            tracks = [
                {
                    key: value for key, value in track.items() if key != "crops"
                } | {
                    "crops": [
                        {k: v for k, v in crop.items() if k != "jpeg"}
                        for crop in track["crops"]
                    ],
                }
                for track in self._tracks.values()
            ]
            return {
                "version": self._version,
                "session": self._session,
                "frame_seq": self._frame_seq,
                "frame_age_sec": round(time.time() - self._frame_ts, 2) if self._frame_ts else None,
                "source": self._source,
                "boxes": list(self._boxes),
                "active_track": self._active_track,
                "tracks": list(reversed(tracks)),
                "counters": dict(self._counters),
            }

    def reset(self) -> None:
        """Clear tracks and counters, keeping the last frame on screen.

        The frame stays because the alternative is a black panel the moment
        someone presses reset, which reads as a camera that just died.
        """
        with self._lock:
            self._tracks.clear()
            # New session: the crops just discarded were cached by every console
            # watching, under keys the next track will reuse.
            self._session = uuid.uuid4().hex[:8]
            self._active_track = None
            self._counters = {"frames": 0, "detections": 0, "ocr_attempts": 0, "ocr_reads": 0}
            self._version += 1


# One bus per process. The inference thread, the test-run worker, and the
# request handlers all address the same device, so a module-level instance is
# the honest shape -- there is never a second gate inside one process.
LIVE = LiveState()
