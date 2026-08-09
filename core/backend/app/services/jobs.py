"""In-memory job store and background runner for video analysis."""

from __future__ import annotations

import threading
import uuid
from datetime import datetime
from pathlib import Path

from app.services.analysis import analyze_video

_JOBS: dict[str, dict] = {}
_LOCK = threading.Lock()


def create_job(video_path: Path, original_name: str) -> str:
    job_id = uuid.uuid4().hex[:12]
    with _LOCK:
        _JOBS[job_id] = {
            "id": job_id,
            "name": original_name,
            "status": "queued",
            "message": "Waiting to start...",
            "result": None,
            "created_at": datetime.now().isoformat(timespec="seconds"),
        }
    thread = threading.Thread(target=_run, args=(job_id, video_path), daemon=True)
    thread.start()
    return job_id


def create_cached_job(name: str, result: dict) -> str:
    job_id = uuid.uuid4().hex[:12]
    if result.get("found"):
        msg = f"Loaded saved result: Truck ID {result['truck_id']}."
    else:
        msg = "Loaded saved result: no clear truck ID was read in this video."
    with _LOCK:
        _JOBS[job_id] = {
            "id": job_id,
            "name": name,
            "status": "done",
            "message": msg,
            "result": result,
            "created_at": datetime.now().isoformat(timespec="seconds"),
        }
    return job_id


def get_job(job_id: str) -> dict | None:
    with _LOCK:
        job = _JOBS.get(job_id)
        return dict(job) if job else None


def register_job(job_id: str, job: dict) -> None:
    """Insert a pre-built job record (used for scripted sample jobs)."""
    with _LOCK:
        _JOBS[job_id] = job


def _set(job_id: str, **fields) -> None:
    with _LOCK:
        if job_id in _JOBS:
            _JOBS[job_id].update(fields)


def _run(job_id: str, video_path: Path) -> None:
    _set(job_id, status="processing", message="Reading the video and looking for truck IDs...")

    def _on_progress(snapshot: dict) -> None:
        """Store live OCR progress so the polling endpoint can surface it."""
        _set(job_id, progress=snapshot)

    try:
        result = analyze_video(video_path, job_id=job_id, progress_cb=_on_progress)
        if result["found"]:
            msg = f"Done! Truck ID {result['truck_id']} identified."
        else:
            msg = "Finished, but no clear truck ID could be read in this video."
        _set(job_id, status="done", message=msg, result=result, progress=None)
    except Exception as exc:
        import traceback
        traceback.print_exc()
        _set(job_id, status="error", message=f"Something went wrong: {exc}")
