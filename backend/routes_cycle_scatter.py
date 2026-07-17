from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
import math
from backend import database

router = APIRouter()

@router.get("/reports/cycle-duration-scatter")
def get_cycle_duration_scatter():
    try:
        crossings = [c for c in database.get_all_crossings() if not c.get("is_duplicate")]
        trucks = database.get_all_trucks()
        
        truck_contractor = {t["hull_id"]: t.get("contractor", "Ad-hoc Contractor") for t in trucks if t.get("hull_id")}
        crossings.sort(key=lambda x: x["timestamp"])
        
        truck_crossings = {}
        for c in crossings:
            truck_crossings.setdefault(c["hull_id"], []).append(c)
            
        now = datetime.utcnow()
        day_ago = now - timedelta(hours=24)
        
        def parse_ts(ts):
            if ts.endswith("Z"): ts = ts[:-1]
            if "." in ts:
                parts = ts.split(".")
                parts[1] = parts[1][:6]
                ts = ".".join(parts)
            return datetime.fromisoformat(ts)
            
        cycles = []
        for hid, c_list in truck_crossings.items():
            contractor = truck_contractor.get(hid, "Ad-hoc Contractor")
            last_inbound = None
            for c in c_list:
                direction = c["direction"].lower()
                if direction == "inbound":
                    last_inbound = c
                elif direction == "outbound" and last_inbound is not None:
                    try:
                        in_time = parse_ts(last_inbound["timestamp"])
                        out_time = parse_ts(c["timestamp"])
                        if out_time >= day_ago:
                            diff = (out_time - in_time).total_seconds() / 60.0
                            if 0 < diff < 1440:
                                time_of_day = out_time.hour + out_time.minute / 60.0
                                time_str = out_time.strftime("%H:%M")
                                cycles.append({
                                    "hull_id": hid,
                                    "contractor": contractor,
                                    "duration": round(diff, 2),
                                    "time_of_day": round(time_of_day, 2),
                                    "time_str": time_str,
                                    "timestamp": c["timestamp"]
                                })
                    except Exception:
                        pass
                    last_inbound = None
                    
        if len(cycles) > 0:
            durations = [c["duration"] for c in cycles]
            mean = sum(durations) / len(durations)
            variance = sum((x - mean) ** 2 for x in durations) / len(durations)
            std_dev = math.sqrt(variance)
        else:
            mean = 0.0
            std_dev = 0.0
            
        for c in cycles:
            if std_dev > 0:
                is_outlier = abs(c["duration"] - mean) > 2.0 * std_dev
            else:
                is_outlier = False
            c["is_outlier"] = is_outlier
            
        return {
            "status": "success",
            "cycles": cycles,
            "mean": round(mean, 2),
            "std_dev": round(std_dev, 2),
            "threshold_high": round(mean + 2.0 * std_dev, 2),
            "threshold_low": round(max(0, mean - 2.0 * std_dev), 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
