from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from backend import database

router = APIRouter()

@router.get("/reports/contractor-efficiency-grid")
def get_contractor_efficiency_grid():
    try:
        crossings = [c for c in database.get_all_crossings() if not c.get("is_duplicate")]
        trucks = database.get_all_trucks()
        
        truck_contractor = {t["hull_id"]: t.get("contractor", "Ad-hoc Contractor") for t in trucks if t.get("hull_id")}
        crossings.sort(key=lambda x: x["timestamp"])
        
        truck_crossings = {}
        for c in crossings:
            truck_crossings.setdefault(c["hull_id"], []).append(c)
            
        blocks = [
            ("02:00-06:00", 2, 6),
            ("06:00-10:00", 6, 10),
            ("10:00-14:00", 10, 14),
            ("14:00-18:00", 14, 18),
            ("18:00-22:00", 18, 22),
            ("22:00-02:00", 22, 2)
        ]
        
        now = datetime.utcnow()
        day_ago = now - timedelta(hours=24)
        
        grid_data = {}
        all_contractors = set(truck_contractor.values())
        all_contractors.add("Ad-hoc Contractor")
        
        for contractor in all_contractors:
            grid_data[contractor] = {b[0]: 0 for b in blocks}
            
        def parse_ts(ts):
            if ts.endswith("Z"): ts = ts[:-1]
            if "." in ts:
                parts = ts.split(".")
                parts[1] = parts[1][:6]
                ts = ".".join(parts)
            return datetime.fromisoformat(ts)
            
        for hid, c_list in truck_crossings.items():
            contractor = truck_contractor.get(hid, "Ad-hoc Contractor")
            last_dir = None
            for c in c_list:
                direction = c["direction"].lower()
                if last_dir == "inbound" and direction == "outbound":
                    try:
                        c_time = parse_ts(c["timestamp"])
                        if c_time >= day_ago:
                            hour = c_time.hour
                            matched_block = None
                            for name, start, end in blocks:
                                if start < end:
                                    if start <= hour < end:
                                        matched_block = name
                                        break
                                else:
                                    if hour >= start or hour < end:
                                        matched_block = name
                                        break
                            if matched_block:
                                grid_data[contractor][matched_block] += 1
                    except Exception:
                        pass
                    last_dir = None
                else:
                    last_dir = direction
                    
        result = []
        for contractor, block_counts in grid_data.items():
            row = {"contractor": contractor, "blocks": {}}
            for b_name, count in block_counts.items():
                row["blocks"][b_name] = {
                    "cycles": count,
                    "efficiency": round(count / 4.0, 2)
                }
            result.append(row)
            
        return {
            "status": "success",
            "grid": result,
            "blocks": [b[0] for b in blocks]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
