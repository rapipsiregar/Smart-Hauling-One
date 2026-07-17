from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from backend import database
from backend.routes_oht_load import get_current_shift_range
from backend.reports_compliance_logic import parse_ts

router = APIRouter(prefix="/reports")

@router.get("/dispatch-discrepancy-grid")
def get_dispatch_discrepancy_grid():
    try:
        now = datetime.utcnow()
        start, end, shift_name = get_current_shift_range(now)
        
        crossings = [c for c in database.get_all_crossings() if not c.get("is_duplicate")]
        trucks = database.get_all_trucks()
        
        # Build registry mapping
        truck_contractor = {t["hull_id"]: t.get("contractor", "Ad-hoc Contractor") for t in trucks if t.get("hull_id")}
        
        # Define last 6 hourly blocks
        hourly_blocks = []
        for i in range(5, -1, -1):
            h_time = now - timedelta(hours=i)
            hourly_blocks.append(h_time.replace(minute=0, second=0, microsecond=0))
            
        contractor_targets = database.get_contractor_targets()
        grid_data = {}
        
        for contractor in contractor_targets.keys():
            grid_data[contractor] = {
                "contractor": contractor,
                "blocks": {}
            }
            for block in hourly_blocks:
                block_str = block.strftime("%H:00")
                grid_data[contractor]["blocks"][block_str] = {
                    "active_fleet": 0,
                    "completed_ritase": 0,
                    "utilization": 0.0
                }
                
        # Group crossings by contractor and hourly block
        for c in crossings:
            try:
                c_ts = parse_ts(c["timestamp"])
                # Match which block
                matched_block = None
                for block in hourly_blocks:
                    if block <= c_ts < block + timedelta(hours=1):
                        matched_block = block
                        break
                if not matched_block:
                    continue
                    
                hid = c["hull_id"]
                contractor = truck_contractor.get(hid, "Ad-hoc Contractor")
                if contractor not in grid_data:
                    continue
                    
                block_str = matched_block.strftime("%H:00")
                # We need to track crossings in this block to count trips & active trucks
                grid_data[contractor]["blocks"][block_str].setdefault("_raw_crossings", []).append(c)
            except Exception:
                continue
                
        # Process each block to count active trucks and completed ritase
        for contractor, row in grid_data.items():
            for block in hourly_blocks:
                block_str = block.strftime("%H:00")
                block_info = row["blocks"][block_str]
                raw_c = block_info.pop("_raw_crossings", [])
                
                # Unique active trucks seen in this hour
                active_trucks = set(c["hull_id"] for c in raw_c)
                block_info["active_fleet"] = len(active_trucks)
                
                # Trips completed in this hour
                trips = 0
                truck_crossings = {}
                for c in raw_c:
                    truck_crossings.setdefault(c["hull_id"], []).append(c)
                    
                for hid, c_list in truck_crossings.items():
                    c_list.sort(key=lambda x: parse_ts(x["timestamp"]))
                    last_dir = None
                    for c in c_list:
                        direction = c["direction"].lower()
                        if last_dir == "inbound" and direction == "outbound":
                            trips += 1
                            last_dir = None
                        else:
                            last_dir = direction
                            
                block_info["completed_ritase"] = trips
                
                # Utilization ratio: completed ritase per active truck vs standard target (typically 1.0 to 2.0 ritase/hr per active truck)
                if len(active_trucks) > 0:
                    # Let's say target expected is 1.5 ritase per truck per hour
                    expected_trips = len(active_trucks) * 1.5
                    block_info["utilization"] = round(trips / expected_trips, 2)
                else:
                    block_info["utilization"] = 0.0
                    
        return {
            "status": "success",
            "blocks": [b.strftime("%H:00") for b in hourly_blocks],
            "grid": list(grid_data.values())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
