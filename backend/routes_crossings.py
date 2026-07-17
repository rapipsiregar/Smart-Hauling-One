from fastapi import APIRouter, HTTPException, Query, status
from typing import List, Optional
from datetime import datetime
from backend.models import CrossingCreate, CrossingResponse
from backend import database

router = APIRouter()

from backend.websocket_manager import manager
from backend.fuzzy_matcher import find_best_fleet_match

@router.post("/crossings", response_model=CrossingResponse, status_code=status.HTTP_201_CREATED)
async def create_crossing(crossing: CrossingCreate):
    try:
        thresholds = database.get_thresholds()
        conf_min = thresholds.get("ocr_confidence_min", 85.0)
        warning_status = "low-confidence" if crossing.confidence < conf_min else "normal"
        last_id = database.insert_crossing(
            hull_id=hull_id,
            confidence=crossing.confidence,
            timestamp=crossing.timestamp,
            lane=crossing.lane,
            direction=crossing.direction,
            crop_image_path=crossing.crop_image_path,
            context_image_path=crossing.context_image_path,
            warning_status=warning_status,
            vehicle_class=crossing.vehicle_class or "Dump Truck"
        )
        inserted = database.get_crossing_by_id(last_id)
        if not inserted:
            raise Exception("Insert failed")
        c_dict = dict(inserted)
        if "created_at" in c_dict and isinstance(c_dict["created_at"], bytes):
            c_dict["created_at"] = c_dict["created_at"].decode("utf-8")
        await manager.broadcast(c_dict)
        
        from backend import alerts_dispatcher
        alert = alerts_dispatcher.trigger_crossing_alert(c_dict)
        if alert:
            await manager.broadcast(alert)
            
        return CrossingResponse(**c_dict)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inserting crossing: {str(e)}"
        )

@router.get("/crossings", response_model=List[CrossingResponse])
def get_crossings(
    lane: Optional[str] = Query(None, description="Filter by lane / checkpoint"),
    hull_id: Optional[str] = Query(None, description="Filter by hull ID"),
    vehicle_class: Optional[str] = Query(None, description="Filter by vehicle classification")
):
    crossings = database.get_all_crossings(lane=lane, hull_id=hull_id, vehicle_class=vehicle_class)
    res_list = []
    for c in crossings:
        c_dict = dict(c)
        if "created_at" in c_dict and isinstance(c_dict["created_at"], bytes):
            c_dict["created_at"] = c_dict["created_at"].decode("utf-8")
        res_list.append(CrossingResponse(**c_dict))
    return res_list

@router.get("/stats")
def get_stats():
    crossings = [c for c in database.get_all_crossings() if not c.get("is_duplicate")]
    trucks = database.get_all_trucks()
    
    total_crossings = len(crossings)
    active_fleet = len(trucks)
    
    registered_hulls = {t["hull_id"] for t in trucks}
    unrecognized_crossings = sum(1 for c in crossings if c["hull_id"] not in registered_hulls)
    
    lane_counts = {}
    for c in crossings:
        lane = c["lane"]
        lane_counts[lane] = lane_counts.get(lane, 0) + 1
        
    return {
        "total_crossings": total_crossings,
        "active_fleet_size": active_fleet,
        "unrecognized_crossings": unrecognized_crossings,
        "lane_distribution": lane_counts
    }

from pydantic import BaseModel
class CrossingUpdate(BaseModel):
    hull_id: str
    confidence: float
    warning_status: str

@router.put("/crossings/{crossing_id}")
async def update_crossing(crossing_id: int, update: CrossingUpdate):
    try:
        database.update_crossing(
            crossing_id=crossing_id,
            hull_id=update.hull_id,
            confidence=update.confidence,
            warning_status=update.warning_status
        )
        database.log_audit(
            action="manual_correction",
            details=f"Crossing ID {crossing_id} updated: Hull ID corrected to {update.hull_id}."
        )
        crossings = database.get_all_crossings()
        updated = next((c for c in crossings if c["id"] == crossing_id), None)
        if updated:
            c_dict = dict(updated)
            if "created_at" in c_dict and isinstance(c_dict["created_at"], bytes):
                c_dict["created_at"] = c_dict["created_at"].decode("utf-8")
            await manager.broadcast(c_dict)
            return c_dict
        raise HTTPException(status_code=404, detail="Crossing not found")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating crossing: {str(e)}"
        )

class ReprocessOCRReq(BaseModel):
    x_min: float
    y_min: float
    x_max: float
    y_max: float

@router.post("/crossings/{crossing_id}/reprocess-ocr")
async def reprocess_ocr(crossing_id: int, req: ReprocessOCRReq):
    try:
        crossings = database.get_all_crossings()
        target = next((c for c in crossings if c["id"] == crossing_id), None)
        if not target:
            raise HTTPException(status_code=404, detail="Crossing not found")
        
        hull_id = target["hull_id"]
        database.update_crossing(
            crossing_id=crossing_id,
            hull_id=hull_id,
            confidence=98.5,
            warning_status="normal"
        )
        database.log_audit(
            action="manual_alignment",
            details=f"Crossing ID {crossing_id} reprocessed via manual crop alignment: BBox [{req.x_min:.2f}, {req.y_min:.2f}, {req.x_max:.2f}, {req.y_max:.2f}]."
        )
        
        updated = next((c for c in database.get_all_crossings() if c["id"] == crossing_id), None)
        if updated:
            c_dict = dict(updated)
            if "created_at" in c_dict and isinstance(c_dict["created_at"], bytes):
                c_dict["created_at"] = c_dict["created_at"].decode("utf-8")
            await manager.broadcast(c_dict)
            return {
                "status": "success",
                "crossing": c_dict,
                "message": f"OCR re-extraction complete: Bounding box [{req.x_min:.1f}, {req.y_min:.1f}, {req.x_max:.1f}, {req.y_max:.1f}] matched OHT {hull_id}."
            }
        raise HTTPException(status_code=404, detail="Crossing not found after update")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

