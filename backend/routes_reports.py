from fastapi import APIRouter, HTTPException, status
from datetime import datetime
from backend import database

router = APIRouter()

@router.get("/reports/shift-summary")
def get_shift_summary():
    try:
        crossings = database.get_all_crossings()
        trucks = database.get_all_trucks()
        
        # 1. Group crossings by truck to calculate completed ritase (inbound -> outbound pairs)
        truck_crossings = {}
        for c in crossings:
            hid = c["hull_id"]
            if hid not in truck_crossings:
                truck_crossings[hid] = []
            truck_crossings[hid].append(c)
            
        completed_ritase = {}
        crossings_count = {}
        for hid, c_list in truck_crossings.items():
            # Sort by timestamp
            c_list.sort(key=lambda x: x["timestamp"])
            crossings_count[hid] = len(c_list)
            
            trips = 0
            last_dir = None
            for c in c_list:
                direction = c["direction"].lower()
                if last_dir == "inbound" and direction == "outbound":
                    trips += 1
                    last_dir = None
                else:
                    last_dir = direction
            completed_ritase[hid] = trips

        # 2. Crossings per 4-hour shifts
        shift_slots = {
            "00:00 - 04:00": 0,
            "04:00 - 08:00": 0,
            "08:00 - 12:00": 0,
            "12:00 - 16:00": 0,
            "16:00 - 20:00": 0,
            "20:00 - 24:00": 0
        }
        for c in crossings:
            try:
                # ISO timestamp e.g. "2026-07-16T15:22:17"
                dt = datetime.fromisoformat(c["timestamp"])
                hour = dt.hour
                slot_index = hour // 4
                slots = list(shift_slots.keys())
                if 0 <= slot_index < len(slots):
                    shift_slots[slots[slot_index]] += 1
            except Exception:
                continue

        # 3. Crossings per date
        date_distribution = {}
        for c in crossings:
            try:
                dt_str = c["timestamp"][:10]
                date_distribution[dt_str] = date_distribution.get(dt_str, 0) + 1
            except Exception:
                continue

        # 4. Subcontractor discrepancies
        discrepancies = []
        truck_registry = {t["hull_id"]: t for t in trucks}
        
        for c in crossings:
            hid = c["hull_id"]
            if hid not in truck_registry:
                discrepancies.append({
                    "timestamp": c["timestamp"],
                    "hull_id": hid,
                    "lane": c["lane"],
                    "type": "Unregistered OHT Crossing",
                    "severity": "high",
                    "details": f"Vehicle is not present in the master fleet registry."
                })
            else:
                registry_item = truck_registry[hid]
                if registry_item["status"] == "inactive":
                    discrepancies.append({
                        "timestamp": c["timestamp"],
                        "hull_id": hid,
                        "lane": c["lane"],
                        "type": "Inactive OHT Activity",
                        "severity": "medium",
                        "details": f"Vehicle is marked INACTIVE in fleet registry but logged crossings."
                    })
                if registry_item["contractor"] in ["Ad-hoc Contractor", "Unknown"]:
                    discrepancies.append({
                        "timestamp": c["timestamp"],
                        "hull_id": hid,
                        "lane": c["lane"],
                        "type": "Unauthorized Contractor",
                        "severity": "low",
                        "details": f"OHT belongs to an ad-hoc or unapproved contractor."
                    })
                    
        return {
            "completed_ritase": completed_ritase,
            "crossings_per_truck": crossings_count,
            "shift_distribution": shift_slots,
            "date_distribution": date_distribution,
            "discrepancies": discrepancies
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error compiling shift summary report: {str(e)}"
        )
