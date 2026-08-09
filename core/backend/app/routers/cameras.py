"""Camera registry endpoints (per-gate camera management)."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.camera import CameraCreate, CameraUpdate
from app.schemas.common import StatusResponse
from app.schemas.edge_config import EdgeConfigUpdate
from app.services import cameras, edge_config
from app.services.dataset import invalidate_cache

router = APIRouter(tags=["cameras"])


@router.get("/cameras")
def list_cameras():
    """All cameras, each enriched with edge health/config summary fields.

    Powers the fleet-wide device-health widget in one call instead of N
    per-camera requests (``docs/edge-system/API_CONTRACT.md`` §2.3). Existing
    fields are unchanged; the new ones are purely additive.
    """
    return [edge_config.attach_health_fields(c) for c in cameras.list_cameras()]


@router.get("/cameras/{camera_code}")
def get_camera(camera_code: str):
    cam = cameras.get_camera(camera_code)
    if cam is None:
        return JSONResponse({"error": "Camera not found"}, status_code=404)
    return cam


@router.post("/cameras")
def create_camera(payload: CameraCreate):
    cam = cameras.create_camera(payload.model_dump(exclude_unset=True))
    if cam is None:
        return JSONResponse(
            {"error": "camera_code and name are required and must be unique"},
            status_code=400,
        )
    return cam


@router.put("/cameras/{camera_code}")
def update_camera(camera_code: str, payload: CameraUpdate):
    cam = cameras.update_camera(camera_code, payload.model_dump(exclude_unset=True))
    if cam is None:
        return JSONResponse(
            {"error": "Camera not found or folder already in use"},
            status_code=400,
        )
    return cam


@router.delete("/cameras/{camera_code}", response_model=StatusResponse)
def delete_camera(camera_code: str):
    if not cameras.delete_camera(camera_code):
        return JSONResponse({"error": "Camera not found"}, status_code=404)
    return {"status": "success"}


@router.get("/cameras/{camera_code}/edge-config")
def get_edge_config(camera_code: str):
    """Current tunables plus device health, for the settings page (§2.1)."""
    cfg = edge_config.get_edge_config(camera_code)
    if cfg is None:
        return JSONResponse({"error": "Camera not found"}, status_code=404)
    return cfg


@router.put("/cameras/{camera_code}/edge-config")
def put_edge_config(camera_code: str, payload: EdgeConfigUpdate):
    """Save per-device tunables. Increments ``config_version`` by exactly 1.

    Ranges are validated before the camera is looked up, so a malformed request
    fails identically whether or not the camera_code happens to exist. Saving for
    an offline device is expected to succeed -- the change simply stays pending
    until that device reconnects (``docs/user_flows/userflow_uc_008.md`` AF-002).
    """
    updated, error = edge_config.update_edge_config(
        camera_code, payload.model_dump(exclude_unset=True)
    )
    if error:
        return JSONResponse({"error": error}, status_code=400)
    if updated is None:
        return JSONResponse({"error": "Camera not found"}, status_code=404)
    return updated


@router.post("/cameras-sync-attribution")
def sync_attribution():
    """Re-tag video_results with camera_id from current playlist folders."""
    tagged = cameras.sync_attribution()
    invalidate_cache()
    return {"status": "success", "tagged": tagged}
