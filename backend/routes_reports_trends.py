from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from backend import database
from backend.database_stats import get_all_daily_stats

router = APIRouter()

@router.get("/reports/subcontractor-trends")
def get_subcontractor_trends():
    try:
        crossings = [c for c in database.get_all_crossings() if not c.get("is_duplicate")]
        trucks = database.get_all_trucks()
        
        truck_crossings = {}
        for c in crossings:
            truck_crossings.setdefault(c["hull_id"], []).append(c)
            
        cycles_by_date = {}  # maps (contractor, date_str) -> cycles count
        
        # 1. Calculate live cycles from active crossings
        for hid, c_list in truck_crossings.items():
            c_list.sort(key=lambda x: x["timestamp"])
            
            truck = next((t for t in trucks if t["hull_id"] == hid), None)
            contractor = truck["contractor"] if truck else "Ad-hoc Contractor"
            
            last_dir = None
            for c in c_list:
                direction = c["direction"].lower()
                if last_dir == "inbound" and direction == "outbound":
                    try:
                        date_str = c["timestamp"].split("T")[0]
                        key = (contractor, date_str)
                        cycles_by_date[key] = cycles_by_date.get(key, 0) + 1
                    except Exception:
                        pass
                    last_dir = None
                else:
                    last_dir = direction

        # 2. Merge historical daily stats database logs
        try:
            historical = get_all_daily_stats()
            for row in historical:
                c = row["contractor"]
                d = row["date"]
                key = (c, d)
                cycles_by_date[key] = cycles_by_date.get(key, 0) + row["cycles"]
        except Exception:
            pass

        # 3. Formulate rolling 7-day window dates
        today = datetime.utcnow().date()
        dates = [(today - timedelta(days=i)).isoformat() for i in range(7)]
        dates.reverse()  # oldest to newest

        # 4. Aggregate trends for unique contractors
        all_contractors = set(t["contractor"] for t in trucks if t.get("contractor"))
        all_contractors.add("Ad-hoc Contractor")
        
        trends = {}
        for contractor in all_contractors:
            daily_series = []
            for d in dates:
                daily_series.append(cycles_by_date.get((contractor, d), 0))
            # Only include contractors who have completed at least one cycle or are active
            trends[contractor] = daily_series
            
        return {
            "status": "success",
            "dates": dates,
            "trends": trends
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
