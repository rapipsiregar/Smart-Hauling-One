from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from backend import database

router = APIRouter()

def parse_ts(ts):
    if ts.endswith("Z"): ts = ts[:-1]
    if "." in ts:
        parts = ts.split(".")
        parts[1] = parts[1][:6]
        ts = ".".join(parts)
    return datetime.fromisoformat(ts)

@router.get("/reports/fleet-utility-heatmap")
def get_fleet_utility_heatmap():
    try:
        crossings = [c for c in database.get_all_crossings() if not c.get("is_duplicate")]
        trucks = database.get_all_trucks()
        
        # Determine reference time (anchor to latest crossing or current time)
        if crossings:
            latest_time = max(parse_ts(c["timestamp"]) for c in crossings)
        else:
            latest_time = datetime.utcnow()
            
        # Define 12 hourly buckets leading up to the latest crossing time
        buckets = []
        for i in range(11, -1, -1):
            t = latest_time - timedelta(hours=i)
            # interval start and end
            start = t.replace(minute=0, second=0, microsecond=0)
            end = start + timedelta(hours=1)
            buckets.append((start.strftime("%H:00"), start, end))
            
        hours_labels = [b[0] for b in buckets]
        
        # Filter crossings within the 12-hour window
        window_start = buckets[0][1]
        window_end = buckets[-1][2]
        
        window_crossings = []
        active_trucks_set = set()
        
        for c in crossings:
            try:
                c_time = parse_ts(c["timestamp"])
                if window_start <= c_time < window_end:
                    window_crossings.append((c["hull_id"], c_time))
                    active_trucks_set.add(c["hull_id"])
            except:
                continue
                
        # If no active trucks in the window, fallback to top registered trucks
        if not active_trucks_set:
            active_trucks_set = {t["hull_id"] for t in trucks[:10] if t.get("hull_id")}
            
        active_trucks = sorted(list(active_trucks_set))
        
        # Build grid
        grid = []
        for truck in active_trucks:
            row = {"truck": truck, "hours": {label: 0 for label in hours_labels}}
            for c_truck, c_time in window_crossings:
                if c_truck == truck:
                    for label, start, end in buckets:
                        if start <= c_time < end:
                            row["hours"][label] += 1
                            break
            grid.append(row)
            
        return {
            "status": "success",
            "hours": hours_labels,
            "trucks": active_trucks,
            "grid": grid
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
