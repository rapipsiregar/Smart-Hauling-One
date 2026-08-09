"""Video ingestion, analysis jobs, and live progress streaming."""

from __future__ import annotations

import asyncio
import json
import shutil
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.config import ALLOWED_VIDEO_EXTS, UPLOAD_DIR
from app.schemas.analysis import AnalyzeExistingRequest
from app.services import jobs
from app.services.analysis import list_playlist_videos, resolve_playlist_video

router = APIRouter(tags=["analysis"])


# --- Job status --------------------------------------------------------------

@router.get("/status/{job_id}")
def status(job_id: str):
    job = jobs.get_job(job_id)
    if job is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return job


@router.get("/jobs/{job_id}")
def job(job_id: str):
    job = jobs.get_job(job_id)
    if job is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return job


@router.get("/jobs/{job_id}/stream")
async def job_stream(job_id: str):
    """SSE endpoint: streams live OCR progress snapshots while a job runs."""
    if jobs.get_job(job_id) is None:
        return JSONResponse({"error": "not found"}, status_code=404)

    async def event_generator():
        prev_hash = None
        while True:
            j = jobs.get_job(job_id)
            if j is None:
                break
            job_status = j["status"]
            progress = j.get("progress")

            if progress is not None:
                cur_hash = (
                    progress.get("frames_scanned", 0),
                    progress.get("ocr_reads", 0),
                )
                if cur_hash != prev_hash:
                    prev_hash = cur_hash
                    payload = json.dumps({"type": "progress", "status": job_status, **progress})
                    yield f"data: {payload}\n\n"

            if job_status in ("done", "error"):
                final = json.dumps({
                    "type": "done" if job_status == "done" else "error",
                    "status": job_status,
                    "message": j.get("message", ""),
                })
                yield f"data: {final}\n\n"
                break

            await asyncio.sleep(0.6)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# --- Playlist / ingestion ----------------------------------------------------

@router.get("/playlist-videos")
def playlist_videos():
    return list_playlist_videos()


@router.post("/upload")
async def upload(video: UploadFile = File(...)):
    suffix = Path(video.filename or "").suffix.lower()
    if suffix not in ALLOWED_VIDEO_EXTS:
        return JSONResponse(
            {"error": "Please upload a video (mp4, mov, mkv, avi, webm)."},
            status_code=400,
        )
    orig = Path(video.filename or "video").name
    stamp = time.strftime("%Y%m%d-%H%M%S")
    dest = UPLOAD_DIR / f"{stamp}__{orig}"
    with dest.open("wb") as f:
        shutil.copyfileobj(video.file, f)
    return {"job_id": jobs.create_job(dest, orig)}


@router.post("/analyze-existing")
async def analyze_existing(payload: AnalyzeExistingRequest):
    src = resolve_playlist_video(payload.name)
    if src is None:
        return JSONResponse({"error": "That video was not found."}, status_code=404)
    # Always run the actual OCR pipeline fresh; never reuse a saved result.
    return {"job_id": jobs.create_job(src, src.name)}


# --- Scripted demo jobs ------------------------------------------------------

@router.get("/create-live-sample-with-distribution")
def create_live_sample():
    job_id = "live_dist_" + uuid.uuid4().hex[:6]
    progress = {
        "frames_scanned": 1240,
        "frames_total": 1370,
        "reads": 1226,
        "ocr_reads": 71,
        "voted_hull_id": "830E",
        "vote_confidence": 0.3343,
        "distribution": [
            {"id": "830E", "weight": 16.79, "reads": 22, "share": 0.3343, "winner": True},
            {"id": "5061", "weight": 11.21, "reads": 14, "share": 0.2232, "winner": False},
            {"id": "SUBT", "weight": 3.53, "reads": 5, "share": 0.0703, "winner": False},
            {"id": "830E-DC", "weight": 2.95, "reads": 4, "share": 0.0588, "winner": False},
            {"id": "30", "weight": 1.56, "reads": 2, "share": 0.0311, "winner": False},
        ],
    }
    jobs.register_job(job_id, {
        "id": job_id,
        "name": "1_vMnSIQTGE.mp4",
        "status": "processing",
        "message": "Scanning video frames and building live OCR candidate distribution...",
        "progress": progress,
        "result": None,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    })
    return {"job_id": job_id}


@router.get("/create-completed-sample")
def create_completed_sample():
    sample_result = {
        "truck_id": "830E",
        "found": True,
        "certainty": 94,
        "reads": 45,
        "ocr_reads": 28,
        "frames_scanned": 150,
        "distribution": [
            {"id": "830E", "weight": 24.5, "reads": 22, "share": 0.94, "winner": True},
            {"id": "5061", "weight": 1.5, "reads": 6, "share": 0.06, "winner": False},
        ],
        "snapshot": "data/web-results/snapshots/sample.jpg",
        "crops": [],
        "annotated_video": None,
    }
    return {"job_id": jobs.create_cached_job("1QJKRHf4ZsQ.mp4", sample_result)}
