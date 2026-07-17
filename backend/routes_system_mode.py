from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend import database

router = APIRouter()

class ModeSettingsReq(BaseModel):
    mode: str  # "demo" or "live"
    rtsp_url: Optional[str] = None

@router.get("/admin/mode")
def get_system_mode():
    try:
        active_mode = database.get_system_setting("active_mode", "demo")
        rtsp_url = database.get_system_setting("rtsp_url", "rtsp://localhost:8554/live")
        return {
            "status": "success",
            "mode": active_mode,
            "rtsp_url": rtsp_url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/mode")
def post_system_mode(req: ModeSettingsReq):
    try:
        if req.mode not in ("demo", "live"):
            raise HTTPException(status_code=400, detail="Mode must be either 'demo' or 'live'")
            
        database.set_system_setting("active_mode", req.mode)
        if req.rtsp_url is not None:
            database.set_system_setting("rtsp_url", req.rtsp_url)
            
        database.log_audit(
            action="set_mode",
            details=f"System operation mode updated to '{req.mode}'. RTSP URL: '{req.rtsp_url or 'unchanged'}'"
        )
        
        return {
            "status": "success",
            "message": f"System mode successfully updated to {req.mode}",
            "mode": req.mode,
            "rtsp_url": req.rtsp_url or database.get_system_setting("rtsp_url", "rtsp://localhost:8554/live")
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
