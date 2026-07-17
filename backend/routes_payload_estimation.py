from fastapi import APIRouter, HTTPException
from datetime import datetime
from backend import database
from backend.routes_oht_load import get_current_shift_range
from backend.reports_compliance_logic import parse_ts

router = APIRouter(prefix="/reports")

# Payload capacity in metric tons per OHT model
MODEL_CAPACITIES = {
    "cat 777": 91.0,
    "cat 777d": 91.0,
    "cat 785": 136.0,
    "hd785": 91.0,
    "komatsu hd785": 91.0,
    "belaz 7513": 130.0,
    "cat 789": 181.0,
    "cat 793": 227.0
}

def get_model_capacity(model_name: str) -> float:
    if not model_name:
        return 90.0
    model_lower = model_name.lower().strip()
    # Match substring
    for key, cap in MODEL_CAPACITIES.items():
        if key in model_lower:
            return cap
    return 90.0

@router.get("/subcontractor-payload")
def get_subcontractor_payload():
    try:
        now = datetime.utcnow()
        start, end, shift_name = get_current_shift_range(now)
        
        crossings = [c for c in database.get_all_crossings() if not c.get("is_duplicate")]
        trucks = database.get_all_trucks()
        
        # Build maps
        truck_info = {
            t["hull_id"]: {
                "contractor": t.get("contractor", "Ad-hoc Contractor"),
                "model": t.get("model", "CAT 777D"),
                "capacity": get_model_capacity(t.get("model", ""))
            } for t in trucks if t.get("hull_id")
        }
        
        # Filter crossings to current shift
        shift_crossings = []
        for c in crossings:
            try:
                c_ts = parse_ts(c["timestamp"])
                if start <= c_ts <= end:
                    shift_crossings.append(c)
            except Exception:
                continue
                
        # Group crossings by truck
        truck_crossings = {}
        for c in shift_crossings:
            hid = c["hull_id"]
            if hid in truck_info:
                truck_crossings.setdefault(hid, []).append(c)
                
        # Calculate completed loops (trips) per truck
        truck_trips = {}
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
            truck_trips[hid] = trips
            
        # Aggregate by subcontractor
        subcontractors = {}
        for hid, info in truck_info.items():
            contractor = info["contractor"]
            if contractor not in subcontractors:
                subcontractors[contractor] = {
                    "contractor": contractor,
                    "completed_trips": 0,
                    "estimated_tonnage": 0.0,
                    "trucks": []
                }
                
            trips = truck_trips.get(hid, 0)
            tonnage = round(trips * info["capacity"], 1)
            
            subcontractors[contractor]["completed_trips"] += trips
            subcontractors[contractor]["estimated_tonnage"] += tonnage
            subcontractors[contractor]["trucks"].append({
                "hull_id": hid,
                "model": info["model"],
                "capacity_tons": info["capacity"],
                "completed_trips": trips,
                "estimated_tonnage": tonnage
            })
            
        # Round final subcontractor total tonnages
        for key in subcontractors:
            subcontractors[key]["estimated_tonnage"] = round(subcontractors[key]["estimated_tonnage"], 1)
            
        return {
            "status": "success",
            "shift_name": shift_name,
            "shift_start": start.isoformat(),
            "shift_end": end.isoformat(),
            "subcontractors": list(subcontractors.values())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
