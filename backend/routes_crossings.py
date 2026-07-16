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
        hull_id = find_best_fleet_match(crossing.hull_id)
        warning_status = "low-confidence" if crossing.confidence < 85 else "normal"
        last_id = database.insert_crossing(
            hull_id=hull_id,
            confidence=crossing.confidence,
            timestamp=crossing.timestamp,
            lane=crossing.lane,
            direction=crossing.direction,
            crop_image_path=crossing.crop_image_path,
            context_image_path=crossing.context_image_path,
            warning_status=warning_status
        )
        res = crossing.dict()
        res["hull_id"] = hull_id
        res["id"] = last_id
        res["warning_status"] = warning_status
        res["created_at"] = datetime.utcnow().isoformat()
        await manager.broadcast(res)
        return CrossingResponse(**res)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inserting crossing: {str(e)}"
        )

@router.get("/crossings", response_model=List[CrossingResponse])
def get_crossings(
    lane: Optional[str] = Query(None, description="Filter by lane / checkpoint"),
    hull_id: Optional[str] = Query(None, description="Filter by hull ID")
):
    crossings = database.get_all_crossings(lane=lane, hull_id=hull_id)
    res_list = []
    for c in crossings:
        c_dict = dict(c)
        if "created_at" in c_dict and isinstance(c_dict["created_at"], bytes):
            c_dict["created_at"] = c_dict["created_at"].decode("utf-8")
        res_list.append(CrossingResponse(**c_dict))
    return res_list

@router.get("/stats")
def get_stats():
    crossings = database.get_all_crossings()
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
