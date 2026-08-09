"""The HUD's state bus: bounded, thread-safe, and image bytes kept off the wire."""

from __future__ import annotations

import threading

import pytest

from agent.live_state import MAX_CROPS_PER_TRACK, MAX_TRACKS, LiveState


@pytest.fixture
def live() -> LiveState:
    return LiveState()


def _crop(live: LiveState, track: int, index: int, text: str | None = "2152") -> None:
    live.add_crop(track, crop_index=index, jpeg=b"jpeg-%d" % index, text=text,
                  raw=text, ocr_conf=0.9, det_conf=0.8, frame=index)


def test_boxes_are_visible_before_any_ocr_lands(live: LiveState) -> None:
    """The whole reason this module exists: detections must not wait on readings."""
    live.open_track(1)
    live.publish_frame(b"jpeg", [{"x0": 0, "y0": 0, "x1": 9, "y1": 9, "conf": 0.9}])

    snapshot = live.snapshot()
    assert len(snapshot["boxes"]) == 1
    assert snapshot["counters"]["detections"] == 1
    # No crop has come back yet, and that is a valid, displayable state.
    assert snapshot["tracks"][0]["crops"] == []
    assert snapshot["counters"]["ocr_attempts"] == 0


def test_snapshot_never_carries_image_bytes(live: LiveState) -> None:
    """Crops are fetched by URL; inlining them would make every poll enormous."""
    live.open_track(1)
    _crop(live, 1, 1)

    crops = live.snapshot()["tracks"][0]["crops"]
    assert crops[0]["text"] == "2152"
    assert "jpeg" not in crops[0]
    # Still retrievable, just not in the JSON.
    assert live.crop_jpeg(1, 1) == b"jpeg-1"


def test_unreadable_attempts_are_kept(live: LiveState) -> None:
    """A failed read is the device working. Hiding it makes a dusty plate look
    like a stalled run."""
    live.open_track(1)
    _crop(live, 1, 1, text=None)

    crops = live.snapshot()["tracks"][0]["crops"]
    assert len(crops) == 1
    assert crops[0]["text"] is None
    assert live.snapshot()["counters"]["ocr_reads"] == 0


def test_tracks_and_crops_are_bounded(live: LiveState) -> None:
    """A gate runs for months; an unbounded buffer is a leak with a long fuse."""
    for track in range(MAX_TRACKS + 5):
        live.open_track(track)
    assert len(live.snapshot()["tracks"]) == MAX_TRACKS

    live.open_track(999)
    for index in range(MAX_CROPS_PER_TRACK + 10):
        _crop(live, 999, index)
    track = next(t for t in live.snapshot()["tracks"] if t["track_id"] == 999)
    assert len(track["crops"]) == MAX_CROPS_PER_TRACK
    # The oldest went, not the newest.
    assert track["crops"][-1]["crop_index"] == MAX_CROPS_PER_TRACK + 9


def test_crop_for_an_evicted_track_is_dropped_not_raised(live: LiveState) -> None:
    """A reading can outlive its track. That is late, not fatal."""
    live.add_crop(4242, crop_index=1, jpeg=b"x", text="1", raw="1",
                  ocr_conf=0.5, det_conf=0.5, frame=1)
    assert live.snapshot()["tracks"] == []


def test_pending_counter_tracks_queued_and_returned(live: LiveState) -> None:
    """What the window-close guard reads to know OCR is still outstanding."""
    live.open_track(1)
    live.note_ocr_queued(1)
    live.note_ocr_queued(1)
    assert live.pending_ocr(1) == 2

    _crop(live, 1, 1)
    assert live.pending_ocr(1) == 1


def test_close_track_records_the_resolved_identity(live: LiveState) -> None:
    live.open_track(1)
    live.update_votes(1, "2152", 0.9, [{"id": "2152", "share": 0.9, "reads": 3,
                                        "weight": 2.1, "winner": True}])
    live.close_track(1, hull_id="HD 2152", outcome="exact", confidence=0.93)

    track = live.snapshot()["tracks"][0]
    assert track["status"] == "done"
    assert track["hull_id"] == "HD 2152"
    assert track["outcome"] == "exact"
    assert track["confidence"] == 0.93


def test_each_bus_has_its_own_session(live: LiveState) -> None:
    """Crop URLs are cached hard by the browser and keyed by (track, crop index),
    but track ids restart from the same number when the process does. Without a
    session in the key the console shows the *previous* run's photograph beside
    the current reading -- observed, not hypothetical."""
    other = LiveState()
    assert live.snapshot()["session"] != other.snapshot()["session"]
    assert live.snapshot()["session"] == live.snapshot()["session"]


def test_reset_starts_a_new_session(live: LiveState) -> None:
    """Reset discards crops that every watching console has already cached, under
    keys the next track will reuse."""
    live.open_track(1)
    _crop(live, 1, 1)
    before = live.snapshot()["session"]

    live.reset()
    assert live.snapshot()["session"] != before


def test_reset_clears_tracks_but_keeps_the_picture(live: LiveState) -> None:
    """Blanking the frame on reset reads as a camera that just died."""
    live.publish_frame(b"jpeg", [])
    live.open_track(1)
    live.reset()

    snapshot = live.snapshot()
    assert snapshot["tracks"] == []
    assert snapshot["counters"]["frames"] == 0
    assert live.latest_frame()[1] == b"jpeg"


def test_wait_for_frame_returns_none_on_timeout(live: LiveState) -> None:
    """The MJPEG generator relies on this to idle without spinning."""
    seq, jpeg = live.wait_for_frame(0, timeout=0.05)
    assert jpeg is None
    assert seq == 0


def test_wait_for_frame_wakes_on_a_new_frame(live: LiveState) -> None:
    def publish() -> None:
        live.publish_frame(b"new", [])

    threading.Timer(0.05, publish).start()
    seq, jpeg = live.wait_for_frame(0, timeout=2.0)
    assert jpeg == b"new"
    assert seq == 1


def test_concurrent_writers_do_not_lose_crops(live: LiveState) -> None:
    """Workers and the detection thread write here at once, by design."""
    live.open_track(1)

    def write(start: int) -> None:
        for i in range(start, start + 5):
            live.add_crop(1, crop_index=i, jpeg=b"j", text="1", raw="1",
                          ocr_conf=0.5, det_conf=0.5, frame=i)

    threads = [threading.Thread(target=write, args=(n * 5,)) for n in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert live.snapshot()["counters"]["ocr_reads"] == 20
