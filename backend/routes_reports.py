from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from datetime import datetime
import io
import csv
import time
from backend import database

router = APIRouter()

_towers_cache = {}

def get_current_towers_telemetry():
    import random
    now = time.time()
    if not _towers_cache or now - _towers_cache.get("last_refresh", 0) > 5:
        gamma_battery = random.randint(25, 48)
        gamma_solar = random.randint(2, 15)
        _towers_cache["last_refresh"] = now
        _towers_cache["towers"] = [
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
                "battery": gamma_battery,
                "solar_output": gamma_solar,
                "latency": random.randint(220, 245),
                "status": "warning" if (gamma_battery < 30 or gamma_solar < 5) else "online"
            }
        ]
    return _towers_cache["towers"]

@router.get("/reports/shift-summary")
def get_shift_summary():
    try:
        crossings = database.get_all_crossings()
        trucks = database.get_all_trucks()
        
        truck_crossings = {}
        for c in crossings:
            hid = c["hull_id"]
            if hid not in truck_crossings:
                truck_crossings[hid] = []
            truck_crossings[hid].append(c)
            
        completed_ritase = {}
        crossings_count = {}
        for hid, c_list in truck_crossings.items():
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

        shift_slots = {
            "00:00 - 04:00": 0, "04:00 - 08:00": 0, "08:00 - 12:00": 0,
            "12:00 - 16:00": 0, "16:00 - 20:00": 0, "20:00 - 24:00": 0
        }
        for c in crossings:
            try:
                dt = datetime.fromisoformat(c["timestamp"])
                slot_index = dt.hour // 4
                slots = list(shift_slots.keys())
                if 0 <= slot_index < len(slots):
                    shift_slots[slots[slot_index]] += 1
            except:
                continue

        date_distribution = {}
        for c in crossings:
            try:
                dt_str = c["timestamp"][:10]
                date_distribution[dt_str] = date_distribution.get(dt_str, 0) + 1
            except:
                continue

        discrepancies = []
        truck_registry = {t["hull_id"]: t for t in trucks}
        
        for c in crossings:
            hid = c["hull_id"]
            if c.get("warning_status") == "low-confidence" or c["confidence"] < 85:
                discrepancies.append({
                    "timestamp": c["timestamp"], "hull_id": hid, "lane": c["lane"],
                    "type": "Low Confidence OCR Alert", "severity": "medium",
                    "details": f"OCR prediction confidence level is too low: {c['confidence']}%."
                })
            if hid not in truck_registry:
                discrepancies.append({
                    "timestamp": c["timestamp"], "hull_id": hid, "lane": c["lane"],
                    "type": "Unregistered OHT Crossing", "severity": "high",
                    "details": "Vehicle is not present in the master fleet registry."
                })
            else:
                r = truck_registry[hid]
                if r["status"] == "inactive":
                    discrepancies.append({
                        "timestamp": c["timestamp"], "hull_id": hid, "lane": c["lane"],
                        "type": "Inactive OHT Activity", "severity": "medium",
                        "details": "Vehicle is marked INACTIVE in fleet registry but logged crossings."
                    })
                if r["contractor"] in ["Ad-hoc Contractor", "Unknown"]:
                    discrepancies.append({
                        "timestamp": c["timestamp"], "hull_id": hid, "lane": c["lane"],
                        "type": "Unauthorized Contractor", "severity": "low",
                        "details": "OHT belongs to an ad-hoc or unapproved contractor."
                    })

        for t in get_current_towers_telemetry():
            if t["battery"] < 30:
                discrepancies.append({
                    "timestamp": datetime.utcnow().isoformat(), "hull_id": t["id"], "lane": t["location"],
                    "type": "Critical Skid Battery Warning", "severity": "high",
                    "details": f"Skid battery level is critically low: {t['battery']}%."
                })
            if t["solar_output"] < 5:
                discrepancies.append({
                    "timestamp": datetime.utcnow().isoformat(), "hull_id": t["id"], "lane": t["location"],
                    "type": "Low Solar Array Output Alert", "severity": "high",
                    "details": f"Solar panel charging output is abnormally low: {t['solar_output']}W."
                })
                    
        return {
            "completed_ritase": completed_ritase, "crossings_per_truck": crossings_count,
            "shift_distribution": shift_slots, "date_distribution": date_distribution, "discrepancies": discrepancies
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports/export-csv")
def export_csv(query: str = None, lane: str = None, direction: str = None):
    try:
        crossings = database.get_all_crossings()
        flt = []
        for c in crossings:
            if (not lane or lane.strip().lower() in c["lane"].strip().lower()) and \
               (not direction or direction.strip().lower() == c["direction"].strip().lower()) and \
               (not query or query.strip().lower() in c["hull_id"].strip().lower()):
                flt.append(c)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Log ID", "Timestamp", "OHT Hull ID", "Lane", "Direction", "Confidence %", "Crop Image Path", "Context Image Path"])
        for c in flt:
            writer.writerow([c["id"], c["timestamp"], c["hull_id"], c["lane"], c["direction"], c["confidence"], c["crop_image_path"], c["context_image_path"]])
        output.seek(0)
        return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=gate_crossings_reconciliation.csv"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reports/sync")
def sync_data():
    try:
        time.sleep(0.4)
        return {"status": "success", "sync_time": datetime.utcnow().isoformat(), "synchronized_records_count": len(database.get_all_crossings())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/telemetry/towers")
def get_towers_telemetry():
    return get_current_towers_telemetry()

@router.get("/admin/backup-db")
def backup_database():
    from fastapi.responses import JSONResponse
    try:
        clean = lambda rows: [{k: (v.decode("utf-8") if isinstance(v, bytes) else v) for k, v in dict(r).items()} for r in rows]
        data = {
            "backup_timestamp": datetime.utcnow().isoformat(),
            "trucks": clean(database.get_all_trucks()),
            "crossings": clean(database.get_all_crossings())
        }
        return JSONResponse(content=data, headers={"Content-Disposition": "attachment; filename=smart_gate_db_backup.json"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
