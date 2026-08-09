"""The MJPEG feed, and the viewer accounting that keeps it from occupying the device.

An open multipart/x-mixed-replace response lives until the client goes away. A
browser holds six connections per origin, so a page that reconnects on a timer
exhausts its own pool and then looks frozen on stale data -- and on the device
side every open stream is a coroutine that must not be holding a worker thread.
Both ends of that are guarded here.

The generator is driven directly rather than through a test client: it never
ends on its own, so anything that reads it to completion hangs.
"""

from __future__ import annotations

import asyncio
import os
import tempfile
from pathlib import Path

import pytest

os.environ.setdefault("SMART_GATE_RUN_AGENT", "false")
os.environ.setdefault("SMART_GATE_CAMERA_CODE", "PYTEST-GATE")
os.environ.setdefault(
    "SMART_GATE_EDGE_DB", str(Path(tempfile.mkdtemp()) / "edge-test.db")
)

from fastapi.testclient import TestClient  # noqa: E402

from agent.live_state import LiveState  # noqa: E402
from app.main import app  # noqa: E402
from app.routers import gate  # noqa: E402


@pytest.fixture(autouse=True)
def reset_viewers():
    gate._stream_viewers = 0
    yield
    gate._stream_viewers = 0


async def _take(generator, count: int) -> list[bytes]:
    """Pull `count` parts, then close -- as a disconnecting client would."""
    out = []
    try:
        async for part in generator:
            out.append(part)
            if len(out) >= count:
                break
    finally:
        await generator.aclose()
    return out


def test_each_new_frame_becomes_one_part() -> None:
    live = LiveState()
    live.publish_frame(b"\xff\xd8first", [])

    async def scenario():
        generator = gate.mjpeg_frames(live, poll_sec=0.005)
        first = await _take(generator, 1)
        return first

    parts = asyncio.run(scenario())
    assert b"first" in parts[0]
    assert b"Content-Type: image/jpeg" in parts[0]
    assert parts[0].startswith(b"--frame")


def test_an_unchanged_frame_is_resent_only_at_the_keepalive_rate() -> None:
    """Two failures to avoid at once.

    Never re-sending leaves the panel blank: a browser commits a
    multipart/x-mixed-replace part only when the *next* boundary arrives, so a
    device that publishes one frame and goes quiet is never drawn. Re-sending on
    every poll would push the same JPEG ~50 times a second at an empty lane.
    """
    live = LiveState()
    live.publish_frame(b"\xff\xd8only", [])

    async def _collect(generator, sink):
        async for part in generator:
            sink.append(part)

    async def scenario():
        generator = gate.mjpeg_frames(live, poll_sec=0.002, keepalive_sec=0.05)
        parts: list[bytes] = []
        task = asyncio.ensure_future(_collect(generator, parts))
        await asyncio.sleep(0.3)
        task.cancel()
        # Let the cancellation land before closing: aclose() on a generator that
        # is still mid-await raises rather than tidying up.
        with pytest.raises(asyncio.CancelledError):
            await task
        return parts

    parts = asyncio.run(scenario())
    # ~0.3s at a 0.05s keepalive: several, but nowhere near the ~150 polls.
    assert 3 <= len(parts) <= 12, len(parts)
    assert all(b"only" in part for part in parts)


def test_the_resting_still_is_streamed_when_nothing_has_been_published(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A cold device must show the lane, not a blank panel."""
    monkeypatch.setattr(gate.idle_view, "cached_still", lambda: b"\xff\xd8resting")
    live = LiveState()

    parts = asyncio.run(_take(gate.mjpeg_frames(live, poll_sec=0.002), 1))
    assert b"resting" in parts[0]


def test_a_new_frame_after_a_quiet_period_is_sent() -> None:
    live = LiveState()
    live.publish_frame(b"\xff\xd8one", [])

    async def scenario():
        generator = gate.mjpeg_frames(live, poll_sec=0.005)
        parts = []
        async for part in generator:
            parts.append(part)
            if len(parts) == 1:
                live.publish_frame(b"\xff\xd8two", [])
            if len(parts) >= 2:
                break
        await generator.aclose()
        return parts

    parts = asyncio.run(scenario())
    assert b"one" in parts[0]
    assert b"two" in parts[1]


def test_detail_on_streams_the_captioned_copy() -> None:
    """The captions are burned into the JPEG by the device, so the toggle has to
    be asked of the device. A toggle that changed nothing would be worse than
    none."""
    live = LiveState()
    live.publish_frame(b"\xff\xd8plain", [], detail_jpeg=b"\xff\xd8captioned")

    plain = asyncio.run(_take(gate.mjpeg_frames(live, poll_sec=0.002), 1))
    detailed = asyncio.run(
        _take(gate.mjpeg_frames(live, detail=True, poll_sec=0.002), 1)
    )
    assert b"plain" in plain[0]
    assert b"captioned" in detailed[0]


def test_the_plain_view_is_what_a_viewer_gets_by_default() -> None:
    """Detail is the exception. An operator watching the lane should not be shown
    a score they did not ask about."""
    live = LiveState()
    live.publish_frame(b"\xff\xd8plain", [], detail_jpeg=b"\xff\xd8captioned")

    parts = asyncio.run(_take(gate.mjpeg_frames(live, poll_sec=0.002), 1))
    assert b"plain" in parts[0]


def test_detail_on_falls_back_to_the_plain_frame() -> None:
    """Nobody had asked for detail when this frame was published, so the second
    encode never happened. A second without captions beats a blank panel."""
    live = LiveState()
    live.publish_frame(b"\xff\xd8plain", [])

    parts = asyncio.run(_take(gate.mjpeg_frames(live, detail=True, poll_sec=0.002), 1))
    assert b"plain" in parts[0]


def test_a_detail_viewer_asks_the_device_to_encode_captions() -> None:
    """The producer skips the second JPEG unless someone is watching that way."""
    live = LiveState()
    live.publish_frame(b"\xff\xd8f", [])
    assert live.detail_wanted() is False

    async def scenario():
        generator = gate.mjpeg_frames(live, detail=True, poll_sec=0.002)
        await generator.__anext__()
        wanted = live.detail_wanted()
        await generator.aclose()
        return wanted, live.detail_wanted()

    during, after = asyncio.run(scenario())
    assert during is True
    # And released on disconnect, or the device encodes captions forever.
    assert after is False


def test_viewer_is_released_when_the_generator_closes() -> None:
    """Without this the cap becomes a slow leak that bricks the feed."""
    live = LiveState()
    live.publish_frame(b"\xff\xd8f", [])
    assert gate._acquire_viewer() is True
    assert gate._stream_viewers == 1

    asyncio.run(_take(gate.mjpeg_frames(live, poll_sec=0.005), 1))
    assert gate._stream_viewers == 0


def test_viewers_are_capped() -> None:
    for _ in range(gate.MAX_STREAM_VIEWERS):
        assert gate._acquire_viewer() is True
    assert gate._acquire_viewer() is False


def test_release_never_goes_negative() -> None:
    """A double release would hand out free slots above the cap."""
    gate._release_viewer()
    gate._release_viewer()
    assert gate._stream_viewers == 0


def test_endpoint_refuses_when_full_rather_than_serving() -> None:
    """A client that leaks connections must not be able to occupy the device."""
    gate._stream_viewers = gate.MAX_STREAM_VIEWERS
    response = TestClient(app).get("/api/live/stream")

    assert response.status_code == 503
    assert "error" in response.json()
    # The refusal must not have consumed a slot of its own.
    assert gate._stream_viewers == gate.MAX_STREAM_VIEWERS
