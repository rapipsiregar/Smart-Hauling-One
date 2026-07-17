from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from backend import database
from backend.routes_oht_load import get_current_shift_range
from backend.reports_compliance_logic import parse_ts

router = APIRouter(prefix="/reports")

@router.get("/contractor-forecast")
def get_contractor_forecast():
    try:
        now = datetime.utcnow()
        start, end, shift_name = get_current_shift_range(now)
        
        # Calculate elapsed and remaining time in current shift (12 hours max)
        elapsed_seconds = (now - start).total_seconds()
        elapsed_hours = max(0.1, min(elapsed_seconds / 3600.0, 12.0))
        remaining_hours = max(0.0, 12.0 - elapsed_hours)
        
        crossings = [c for c in database.get_all_crossings() if not c.get("is_duplicate")]
        trucks = database.get_all_trucks()
        
        # Build registry map
        truck_contractor = {t["hull_id"]: t.get("contractor", "Ad-hoc Contractor") for t in trucks if t.get("hull_id")}
        truck_status = {t["hull_id"]: t.get("status", "active") for t in trucks if t.get("hull_id")}
        
        # Filter crossings in the current shift
        shift_crossings = []
        for c in crossings:
            try:
                c_ts = parse_ts(c["timestamp"])
                if start <= c_ts < end:
                    shift_crossings.append(c)
            except Exception:
                continue
                
        # Group crossings by vehicle
        truck_crossings = {}
        for c in shift_crossings:
            hid = c["hull_id"]
            truck_crossings.setdefault(hid, []).append(c)
            
        # Calculate completed ritase per vehicle & group by contractor
        contractor_completed = {}
        contractor_active_hids = {}
        
        for hid, c_list in truck_crossings.items():
            c_list.sort(key=lambda x: parse_ts(x["timestamp"]))
            
            trips = 0
            last_dir = None
            for c in c_list:
                direction = c["direction"].lower()
                if last_dir == "inbound" and direction == "outbound":
                    trips += 1
                    last_dir = None
                else:
                    last_dir = direction
            
            contractor = truck_contractor.get(hid, "Ad-hoc Contractor")
            contractor_completed[contractor] = contractor_completed.get(contractor, 0) + trips
            
            if trips > 0:
                contractor_active_hids.setdefault(contractor, set()).add(hid)
                
        contractor_targets = database.get_contractor_targets()
        predictions = {}
        
        for contractor, target in contractor_targets.items():
            completed = contractor_completed.get(contractor, 0)
            active_fleet = len(contractor_active_hids.get(contractor, set()))
            
            # Simple linear rolling projection
            current_rate = round(completed / elapsed_hours, 2)
            projected = round(completed + (current_rate * remaining_hours), 1)
            
            # Shift target = target_hourly_rate * 12 hours
            shift_target = round(target * 12.0, 1)
            
            # Predict status
            if shift_target <= 0:
                status = "On Track"
            elif projected >= shift_target:
                status = "On Track"
            elif projected >= shift_target * 0.8:
                status = "At Risk"
            else:
                status = "Behind"
                
            predictions[contractor] = {
                "shift_name": shift_name,
                "elapsed_hours": round(elapsed_hours, 2),
                "remaining_hours": round(remaining_hours, 2),
                "completed_ritase": completed,
                "active_fleet": active_fleet,
                "current_rate": current_rate,
                "projected_ritase": projected,
                "shift_target": shift_target,
                "status": status
            }
            
        return {
            "status": "success",
            "predictions": predictions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
