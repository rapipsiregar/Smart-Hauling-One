from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from datetime import datetime
import io
import csv
import time
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

@router.get("/reports/export-csv")
def export_csv(lane: str = None, direction: str = None, query: str = None):
    try:
        crossings = database.get_all_crossings()
        filtered_crossings = []
        for c in crossings:
            if lane and lane.strip().lower() != c["lane"].strip().lower():
                continue
            if direction and direction.strip().lower() != c["direction"].strip().lower():
                continue
            if query and query.strip().lower() not in c["hull_id"].strip().lower():
                continue
            filtered_crossings.append(c)
            
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Log ID", "Timestamp", "OHT Hull ID", "Lane", "Direction", "Confidence %", "Crop Image Path", "Context Image Path"])
        for c in filtered_crossings:
            writer.writerow([
                c["id"], c["timestamp"], c["hull_id"], c["lane"], c["direction"],
                c["confidence"], c["crop_image_path"], c["context_image_path"]
            ])
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=gate_crossings_reconciliation.csv"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exporting CSV crossings sheet: {str(e)}"
        )

@router.post("/reports/sync")
def sync_data():
    try:
        crossings = database.get_all_crossings()
        time.sleep(0.4)
        return {
            "status": "success",
            "sync_time": datetime.utcnow().isoformat(),
            "synchronized_records_count": len(crossings)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cloud reconciliation sync failed: {str(e)}"
        )

@router.get("/telemetry/towers")
def get_towers_telemetry():
    import random
    return [
        {
            "id": "Tower-Alpha",
            "location": "North Checkpoint",
            "battery": random.randint(82, 86),
            "solar_output": random.randint(115, 125),
            "latency": random.randint(35, 45),
            "status": "online"
        },
        {
            "id": "Tower-Beta",
            "location": "South Gate",
            "battery": random.randint(89, 93),
            "solar_output": random.randint(90, 100),
            "latency": random.randint(55, 65),
            "status": "online"
        },
        {
            "id": "Tower-Gamma",
            "location": "Main Portal",
            "battery": random.randint(40, 48),
            "solar_output": random.randint(5, 15),
            "latency": random.randint(220, 245),
            "status": "warning"
        }
    ]
