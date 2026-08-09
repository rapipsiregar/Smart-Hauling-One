"""The local API this gate's UI reads.

Scoped to one gate by construction -- there is no camera_code parameter anywhere,
because a device only ever knows about itself.
"""

from __future__ import annotations

import asyncio
import json
import os
import threading
import time

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel, Field

from agent import ocr_backends
from app import store
from app.services import clip_sources, idle_view, local_matcher, test_runs

router = APIRouter(tags=["gate"])

# Same ranges the core enforces (docs/edge-system/API_CONTRACT.md §2.2). Repeated
# rather than imported: full independence from core/ is deliberate here.
TUNABLE_RANGES = {
    "yolo_fps": (1, 30),
    "ocr_fps": (1, 15),
    "detect_window_sec": (1, 30),
    "ocr_min_conf": (0.0, 1.0),
    "dedup_iou": (0.0, 1.0),
}


class SettingsUpdate(BaseModel):
    yolo_fps: int | None = None
    ocr_fps: int | None = None
    detect_window_sec: int | None = None
    ocr_min_conf: float | None = None
    dedup_iou: float | None = None


class MatchProbe(BaseModel):
    text: str = Field(description="A raw OCR reading to resolve, e.g. 'HD 215Z'")


def _agent(request: Request):
    return getattr(request.app.state, "agent", None)


@router.get("/status")
def status(request: Request):
    """Everything the technician standing at the gate needs in one call."""
    agent = _agent(request)
    counts = store.crossing_counts()
    return {
        "camera_code": os.environ.get("SMART_GATE_CAMERA_CODE", "UNCONFIGURED"),
        # Which way this lane faces, learned from the core. A camera code says
        # nothing about it, and it is what decides whether a crossing counts as
        # an arrival or a departure -- so the person at the gate should be able
        # to read it off the screen rather than infer it from the gate's name.
        "direction": clip_sources.get_gate_direction(),
        "agent_running": agent is not None and agent.is_alive(),
        # Reported separately from agent_running on purpose: the inference thread
        # can die (no CUDA, missing weights) while every other thread carries on,
        # and "running" would then describe a gate that detects nothing.
        "detecting": agent.detecting() if agent else False,
        "camera_connected": agent.camera_connected() if agent else False,
        # The agent's live answer when it is running. With the agent off there is
        # no MasterSync to ask, but the boot-time config fetch has already been to
        # the core and back -- so fall back to whether that succeeded rather than
        # reporting "Terputus" about a centre this device just spoke to.
        "core_reachable": (
            agent.core_reachable() if agent
            else clip_sources.core_last_contact() is not None
        ),
        "core_last_contact": clip_sources.core_last_contact(),
        "outbox_depth": agent.outbox_depth() if agent else 0,
        "crossings": counts,
        "master": {
            "units": store.master_count(),
            "version": store.master_version(),
        },
        "settings": agent.settings() if agent else _stored_settings(),
        # Which recogniser this device is running. Two gates reading the same
        # truck differently is a support call, and the first question is always
        # which engine each one has -- so it is on the screen rather than in a
        # log on the device.
        "ocr_backend": ocr_backends.resolve_backend(),
        "last_error": agent.last_error() if agent else None,
    }


def _stored_settings() -> dict:
    """Settings from local storage, for when the agent is not running."""
    defaults = {
        "yolo_fps": 20, "ocr_fps": 4, "detect_window_sec": 6,
        "ocr_min_conf": 0.30, "dedup_iou": 0.92,
    }
    return {
        key: (float(v) if isinstance(default, float) else int(v))
        if (v := store.get_meta(f"setting_{key}")) is not None else default
        for key, default in defaults.items()
    }


@router.get("/crossings")
def crossings(limit: int = 50):
    """This gate's own detections, newest first, straight from local storage."""
    return store.recent_crossings(min(max(limit, 1), 500))


@router.get("/crossings/{crossing_id}/snapshot")
def crossing_snapshot(crossing_id: int):
    """The crop this gate voted on, for inspecting a reading after the fact.

    404 rather than a placeholder when it is gone: an empty-window crossing never
    had a crop, and old ones are pruned. The UI shows that as "no image", which
    is true, instead of implying the camera saw nothing.
    """
    path = store.snapshot_path_for(crossing_id)
    if path is None:
        return JSONResponse({"error": "No snapshot for this crossing"}, 404)
    return FileResponse(path, media_type="image/jpeg")


@router.post("/crossings-reset")
def reset_crossings():
    """Erase this gate's crossing history so a test can be repeated from empty.

    Local to this device by design. The core has its own reset -- one button
    cannot reach four Jetsons over a link that may be down, and pretending
    otherwise would leave an operator believing a gate was cleared when it was
    not.
    """
    return {"status": "success", "removed": store.clear_crossings()}


@router.get("/settings")
def get_settings(request: Request):
    agent = _agent(request)
    return agent.settings() if agent else _stored_settings()


@router.put("/settings")
def put_settings(payload: SettingsUpdate, request: Request):
    """Change inference settings on the device itself.

    Applies immediately and survives a restart. The core may still push its own
    config later; that is expected, and the operator can simply set it again --
    the core remains authoritative for fleet-wide policy.
    """
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        return JSONResponse({"error": "At least one settings field is required"}, 400)

    for field, value in fields.items():
        low, high = TUNABLE_RANGES[field]
        if value is None or isinstance(value, bool) or not isinstance(value, (int, float)):
            return JSONResponse({"error": f"{field} must be a number"}, 400)
        if not (low <= value <= high):
            return JSONResponse(
                {"error": f"{field} must be between {low} and {high}"}, 400
            )

    for field, value in fields.items():
        store.set_meta(f"setting_{field}", str(value))

    agent = _agent(request)
    if agent is not None:
        agent.apply_settings(fields)
    return get_settings(request)


# --- OCR Inspection HUD -------------------------------------------------------
# The gate is what detects, so this is where a detection can be watched happening.
# The core deliberately has no equivalent: it receives crossings, it does not
# produce them, and a test bench there could only exercise a second pipeline.

class TestRunRequest(BaseModel):
    clips: list[str] | None = Field(
        default=None, description="Clip filenames; omit to run every clip on the device"
    )


@router.get("/video-sources")
def video_sources(direction: str | None = None):
    """Recorded clips available on this device for a test run."""
    return clip_sources.list_clips(direction=direction)


@router.get("/video-sources/{filename}")
def get_video_source_file(filename: str):
    """Serve a recorded clip video file directly for preview."""
    file_path = (clip_sources.CLIP_DIR / filename).resolve()
    if not file_path.is_file() or file_path.parent != clip_sources.CLIP_DIR.resolve():
        return JSONResponse({"error": "File not found"}, 404)
    return FileResponse(file_path, media_type="video/mp4")


@router.post("/test-runs")
def start_test_run(payload: TestRunRequest):
    try:
        return test_runs.start_run(
            payload.clips, os.environ.get("SMART_GATE_CAMERA_CODE", "UNCONFIGURED")
        )
    except test_runs.RunBusy as busy:
        return JSONResponse(
            {"error": "Masih ada proses yang berjalan.", "activeRunId": str(busy)}, 409
        )
    except ValueError as err:
        return JSONResponse({"error": str(err)}, 400)


@router.get("/test-runs/active")
def active_test_run():
    """The run in progress, else the most recent one, else null.

    The run lives on the device, not in the page, so a reload or a second browser
    picks the same one back up.
    """
    return test_runs.active_run() or test_runs.latest_run()


@router.get("/test-runs/{run_id}")
def get_test_run(run_id: str):
    run = test_runs.get_run(run_id)
    if run is None:
        return JSONResponse({"error": "Run not found"}, 404)
    return run


@router.post("/test-runs/{run_id}/cancel")
def cancel_test_run(run_id: str):
    if not test_runs.cancel_run(run_id):
        return JSONResponse({"error": "Run not found or already finished"}, 404)
    return {"status": "success"}


@router.get("/test-runs/{run_id}/stream")
async def stream_test_run(run_id: str):
    """Server-sent events: the vote as it is being decided.

    Only pushes when something actually changed, so an idle run costs one
    keep-alive comment rather than a flood of identical frames.
    """
    if test_runs.get_run(run_id) is None:
        return JSONResponse({"error": "Run not found"}, 404)

    async def events():
        previous = None
        while True:
            run = test_runs.get_run(run_id)
            if run is None:
                break
            current = json.dumps(run, default=str)
            if current != previous:
                yield f"data: {current}\n\n"
                previous = current
            if run["status"] not in test_runs.ACTIVE_STATUSES:
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(events(), media_type="text/event-stream")


# --- Live inspection view -----------------------------------------------------
# The annotated feed, and the OCR samples behind each reading. Served only to
# this gate's own console over the LAN. The stream that reaches the centre is
# still agent/live_view.py's raw one -- PRD Goal 7's non-goal is about evidence
# leaving the device, and nothing here leaves it.

@router.get("/live/state")
def live_state():
    """Boxes, tracks, and OCR samples as they stand right now.

    Image bytes are deliberately absent; each crop is fetched by URL below. A
    console polling several times a second must not be re-downloading every crop
    it already has.
    """
    from agent.live_state import LIVE

    return LIVE.snapshot()


@router.get("/live/crops/{track_id}/{crop_index}")
def live_crop(track_id: int, crop_index: int):
    """One OCR sample image -- the crop the recogniser actually saw."""
    from agent.live_state import LIVE

    jpeg = LIVE.crop_jpeg(track_id, crop_index)
    if not jpeg:
        return JSONResponse({"error": "No such crop"}, 404)
    return Response(content=jpeg, media_type="image/jpeg",
                    # Crops never change once written, so let the browser keep them.
                    headers={"Cache-Control": "public, max-age=3600"})


# An MJPEG response is open for as long as anyone is watching, so viewers are a
# bounded resource rather than a free one. Four is generous for a device whose
# console is normally one browser tab -- and the cap is what stops a client that
# leaks connections (a reconnect loop, a tab that will not die) from occupying
# the device indefinitely.
MAX_STREAM_VIEWERS = 4
_stream_viewers = 0
_stream_lock = threading.Lock()

STREAM_BOUNDARY = "frame"
# Caps the feed near 50 fps -- well above what the detector produces -- and keeps
# a disconnect noticed promptly.
STREAM_POLL_SEC = 0.02
# How often the current frame is re-sent when nothing new has arrived.
#
# Not a nicety. A browser rendering multipart/x-mixed-replace only commits a part
# once it sees the *next* boundary, so a device that publishes one frame and then
# goes quiet leaves the panel blank -- the frame has been sent and is sitting in
# the parser. Re-sending flushes the previous part and keeps the last known
# picture on screen between trucks, which is what a gate console should show.
# One frame a second on the LAN; nothing here crosses the satellite link.
STREAM_KEEPALIVE_SEC = 1.0


def _acquire_viewer() -> bool:
    global _stream_viewers
    with _stream_lock:
        if _stream_viewers >= MAX_STREAM_VIEWERS:
            return False
        _stream_viewers += 1
        return True


def _release_viewer() -> None:
    global _stream_viewers
    with _stream_lock:
        _stream_viewers = max(0, _stream_viewers - 1)


def mjpeg_part(jpeg: bytes) -> bytes:
    """One multipart chunk. Content-Length keeps browsers from guessing."""
    return (b"--" + STREAM_BOUNDARY.encode() + b"\r\n"
            b"Content-Type: image/jpeg\r\n"
            b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n"
            + jpeg + b"\r\n")


async def mjpeg_frames(
    live,
    *,
    detail: bool = False,
    poll_sec: float = STREAM_POLL_SEC,
    keepalive_sec: float = STREAM_KEEPALIVE_SEC,
    clock=None,
):
    """Yield each new annotated frame, forever, until the client goes away.

    Module-level rather than nested in the handler so it can be driven directly:
    a generator that never ends cannot be exercised through a test client
    without hanging it.

    Polls with ``asyncio.sleep`` rather than blocking in a worker thread -- a
    thread per viewer per frame would eat the pool this same process needs for
    every other request, on a box whose real job is inference.
    """
    now = clock or time.monotonic
    last_seq = -1
    last_sent_at = 0.0
    if detail:
        # Tells the detection thread to start encoding the captioned copy. It
        # does not do so otherwise, so the first frame or two still arrive plain
        # -- a second without captions beats a second of nothing.
        live.add_detail_viewer(1)
    try:
        while True:
            seq, jpeg = live.latest_frame(detail=detail)
            if jpeg is None:
                # Nothing has ever been published. Show the resting view so the
                # panel shows the lane rather than a spinner.
                jpeg, seq = idle_view.cached_still(), -2
                if jpeg is None:
                    await asyncio.sleep(poll_sec)
                    continue

            fresh = seq != last_seq
            if fresh or (now() - last_sent_at) >= keepalive_sec:
                last_seq, last_sent_at = seq, now()
                yield mjpeg_part(jpeg)
                if fresh:
                    continue
            await asyncio.sleep(poll_sec)
    finally:
        # Runs on client disconnect, which is the only way this ends.
        if detail:
            live.add_detail_viewer(-1)
        _release_viewer()


@router.get("/live/stream")
async def live_stream(detail: int = 0):
    """MJPEG of the annotated view: the lane with detection boxes drawn on it.

    multipart/x-mixed-replace rather than WebRTC on purpose. This is a LAN
    consumer on the same box as the producer, so there is no negotiation to do
    and no relay to depend on -- and it degrades to "the last frame, held" rather
    than to a black player, which is the right failure on a gate screen.

    Polled with ``asyncio.sleep`` rather than ``asyncio.to_thread`` on a blocking
    wait: a thread per viewer per frame would eat the worker pool this same
    process needs to answer every other request, on a box whose real job is
    inference.
    """
    from agent.live_state import LIVE

    if not _acquire_viewer():
        return JSONResponse(
            {"error": "Terlalu banyak penonton siaran di perangkat ini"}, 503
        )

    return StreamingResponse(
        mjpeg_frames(LIVE, detail=bool(detail)),
        media_type=f"multipart/x-mixed-replace; boundary={STREAM_BOUNDARY}",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@router.post("/live/reset")
def live_reset():
    """Clear the HUD's tracks so a demo can be repeated from a clean panel.

    Only the live view. Recorded crossings are a separate thing with a separate
    button -- clearing what is on screen must never quietly delete the gate's
    record of trucks that actually passed.
    """
    from agent.live_state import LIVE

    LIVE.reset()
    return {"status": "success"}


@router.get("/idle-frame")
def idle_frame(request: Request):
    """The lane with no truck on it: live when the camera is up, else a still."""
    jpeg = idle_view.live_frame(_agent(request)) or idle_view.cached_still()
    if jpeg is None:
        return JSONResponse({"error": "No camera and no cached frame"}, 404)
    return Response(
        content=jpeg,
        media_type="image/jpeg",
        # Live frames must not be cached; the still is cheap to re-send.
        headers={"Cache-Control": "no-store"},
    )


@router.get("/master")
def master():
    """The local replica's size and version -- is this gate's roster current?"""
    return {
        "units": store.master_count(),
        "version": store.master_version(),
        "codes_sample": store.all_hull_codes()[:10],
    }


@router.post("/match-probe")
def match_probe(payload: MatchProbe):
    """Resolve a reading by hand, against this device's own replica.

    A field-diagnosis tool: it answers "would this gate recognise that number,
    and if not, why" without needing the core or a round trip.
    """
    result = local_matcher.match_reading(payload.text)
    return {
        "input": payload.text,
        "extracted_code": result.raw_code,
        "outcome": result.outcome,
        "hull_id": result.hull_id,
        "hull_code": result.hull_code,
        "distance": result.distance,
        "ambiguous_candidates": list(result.candidates),
    }
