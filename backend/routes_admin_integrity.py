from fastapi import APIRouter, HTTPException
import os
from backend import database

router = APIRouter()

@router.get("/admin/db-integrity")
def check_db_integrity():
    try:
        crossings = database.get_all_crossings()
        trucks = database.get_all_trucks()
        
        registered_hulls = {t["hull_id"] for t in trucks if t.get("hull_id")}
        
        total_crossings = len(crossings)
        unregistered_count = 0
        missing_images_count = 0
        corrupt_metadata_count = 0
        
        warnings = []
        
        for c in crossings:
            cid = c.get("id")
            hull_id = c.get("hull_id")
            timestamp = c.get("timestamp")
            crop_img = c.get("crop_image_path")
            context_img = c.get("context_image_path")
            
            # 1. Check metadata corruption
            if not hull_id or not timestamp:
                corrupt_metadata_count += 1
                warnings.append({
                    "crossing_id": cid,
                    "hull_id": hull_id or "UNKNOWN",
                    "timestamp": timestamp or "UNKNOWN",
                    "issue_type": "corrupt_metadata",
                    "details": "Crossing record is missing crucial Hull ID or timestamp field."
                })
                continue
                
            # 2. Check unregistered OHTs
            if hull_id not in registered_hulls:
                unregistered_count += 1
                warnings.append({
                    "crossing_id": cid,
                    "hull_id": hull_id,
                    "timestamp": timestamp,
                    "issue_type": "unregistered_oht",
                    "details": f"OHT Hull ID '{hull_id}' is not registered in the master fleet registry."
                })
                
            # 3. Check physical images existence
            for img_path, issue_name in [(crop_img, "missing_crop_image"), (context_img, "missing_context_image")]:
                if img_path:
                    rel_path = img_path
                    if rel_path.startswith("/evidence/"):
                        rel_path = rel_path.replace("/evidence/", "", 1)
                    
                    physical_path = os.path.join("data", "evidence", rel_path)
                    if not os.path.exists(physical_path):
                        missing_images_count += 1
                        warnings.append({
                            "crossing_id": cid,
                            "hull_id": hull_id,
                            "timestamp": timestamp,
                            "issue_type": issue_name,
                            "details": f"Image file is missing from storage at path: {physical_path}"
                        })
                        
        health_numerator = total_crossings - corrupt_metadata_count - missing_images_count
        overall_health = round((health_numerator / max(total_crossings, 1)) * 100, 1)
        
        return {
            "status": "success",
            "summary": {
                "total_crossings_scanned": total_crossings,
                "unregistered_oht_crossings": unregistered_count,
                "missing_evidence_images": missing_images_count,
                "corrupt_metadata_records": corrupt_metadata_count,
                "overall_health_pct": overall_health
            },
            "warnings": warnings[:200]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
