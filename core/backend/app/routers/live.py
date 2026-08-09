"""Dashboard-facing live-view control (``docs/edge-system/API_CONTRACT.md`` §2.4).

Raw camera feed only -- never a detection overlay. This is the one dashboard
surface that deliberately shows no inference results at all (PRD Non-Goal).
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.edge import LiveSessionRef
from app.services import cameras, live_sessions

router = APIRouter(tags=["live"])


@router.post("/cameras/{camera_code}/live/start")
def live_start(camera_code: str):
    """Open (or rejoin) this gate's live session.

    Returns 200 even when the device is offline: the session enters ``requested``
    and simply never produces video until the device's long-poll picks it up
    (API_CONTRACT §2.4). The frontend treats "no video within a few seconds" as
    "device unreachable" -- it must not retry this endpoint, and this endpoint
    must not pre-emptively fail based on ``device_status``.
    """
    if cameras.get_camera(camera_code) is None:
        return JSONResponse({"error": "Camera not found"}, status_code=404)
    session = live_sessions.start_session(camera_code)
    return {
        "session_id": session.session_id,
        "whep_url": live_sessions.whep_url(camera_code, session.session_id),
    }


@router.post("/cameras/{camera_code}/live/heartbeat")
def live_heartbeat(camera_code: str, body: LiveSessionRef):
    """Viewer keep-alive, sent roughly every 10s while the view is open."""
    if not live_sessions.heartbeat_session(camera_code, body.session_id):
        return JSONResponse({"error": "Session not found"}, status_code=404)
    return {"status": "success"}


@router.post("/cameras/{camera_code}/live/stop")
def live_stop(camera_code: str, body: LiveSessionRef):
    """End the session. Idempotent -- stopping an ended session is not an error."""
    live_sessions.stop_session(camera_code, body.session_id)
    return {"status": "success"}
