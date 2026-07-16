from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from datetime import datetime
import io
import csv
import time
from backend import database

router = APIRouter()

from backend.routes_telemetry import get_current_towers_telemetry

@router.get("/reports/shift-summary")
def get_shift_summary():
    try:
        crossings = [c for c in database.get_all_crossings() if not c.get("is_duplicate")]
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
        from backend.database_stats import get_all_daily_stats
        try:
            for row in get_all_daily_stats():
                d = row["date"]
                date_distribution[d] = date_distribution.get(d, 0) + row["crossings"]
        except:
            pass

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
            if c.get("warning_status") == "cycle-discrepancy":
                discrepancies.append({
                    "timestamp": c["timestamp"], "hull_id": hid, "lane": c["lane"],
                    "type": "Cycle Discrepancy Alert", "severity": "medium",
                    "details": f"Consecutive {c['direction']} crossings logged without completing a full haulage cycle."
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

        thresholds = database.get_thresholds()
        b_low = thresholds["battery_low"]
        s_low = thresholds["solar_low"]
        for t in get_current_towers_telemetry():
            if t["battery"] < b_low or t["battery"] < 20.0:
                severity = "high" if t["battery"] < 20.0 else "medium"
                discrepancies.append({
                    "timestamp": datetime.utcnow().isoformat(), "hull_id": t["id"], "lane": t["location"],
                    "type": "Critical Skid Battery Warning", "severity": severity,
                    "details": f"Skid battery level is critically low: {t['battery']}%."
                })
            if t["solar_output"] < s_low or t["solar_output"] < 15.0:
                severity = "high" if t["solar_output"] < 15.0 else "medium"
                discrepancies.append({
                    "timestamp": datetime.utcnow().isoformat(), "hull_id": t["id"], "lane": t["location"],
                    "type": "Low Solar Array Output Alert", "severity": severity,
                    "details": f"Solar panel charging output is abnormally low: {t['solar_output']}W."
                })
                    
        active_hours = 1.0
        if crossings:
            try:
                def parse_ts(ts):
                    if ts.endswith("Z"): ts = ts[:-1]
                    if "." in ts:
                        parts = ts.split(".")
                        parts[1] = parts[1][:6]
                        ts = ".".join(parts)
                    return datetime.fromisoformat(ts)
                timestamps = [parse_ts(c["timestamp"]) for c in crossings]
                diff = (max(timestamps) - min(timestamps)).total_seconds() / 3600.0
                if diff > 0.1: active_hours = diff
            except: pass

        contractor_cycles = {}
        for hid, cycles in completed_ritase.items():
            truck = next((t for t in trucks if t["hull_id"] == hid), None)
            contractor = truck["contractor"] if truck else "Ad-hoc Contractor"
            contractor_cycles[contractor] = contractor_cycles.get(contractor, 0) + cycles

        from backend.database_stats import get_all_daily_stats
        try:
            day_hours = {}
            for row in get_all_daily_stats():
                c = row["contractor"]
                contractor_cycles[c] = contractor_cycles.get(c, 0) + row["cycles"]
                day_hours[row["date"]] = max(day_hours.get(row["date"], 0.0), row.get("active_hours", 24.0))
            active_hours += sum(day_hours.values())
        except:
            pass

        contractor_thresholds = database.get_contractor_targets()

        compliance = {}
        for contractor, target in contractor_thresholds.items():
            cycles = contractor_cycles.get(contractor, 0)
            hourly_rate = round(cycles / active_hours, 2)
            pct = round(min((hourly_rate / target) * 100, 100.0), 1)
            compliance[contractor] = {"completed_cycles": cycles, "hourly_capacity": hourly_rate, "target_threshold": target, "compliance_pct": pct}

        return {
            "completed_ritase": completed_ritase, "crossings_per_truck": crossings_count,
            "shift_distribution": shift_slots, "date_distribution": date_distribution, 
            "discrepancies": discrepancies, "compliance": compliance
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
    try: time.sleep(0.4); return {"status": "success", "sync_time": datetime.utcnow().isoformat(), "synchronized_records_count": len(database.get_all_crossings())}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

# Backup & Restore endpoints moved to routes_admin.py

from datetime import timedelta

@router.get("/reports/utilization")
def get_fleet_utilization():
    try:
        trucks = database.get_all_trucks()
        crossings = database.get_all_crossings()
        active_trucks = [t for t in trucks if t["status"] == "active"]
        total_active = len(active_trucks)
        now = datetime.utcnow()
        day_ago = now - timedelta(days=1)
        def parse_ts(ts):
            if ts.endswith("Z"): ts = ts[:-1]
            if "." in ts:
                parts = ts.split(".")
                parts[1] = parts[1][:6]
                ts = ".".join(parts)
            return datetime.fromisoformat(ts)
        recent_crossings = []
        for c in crossings:
            try:
                dt = parse_ts(c["timestamp"])
                if dt >= day_ago:
                    recent_crossings.append(c)
            except:
                pass
        active_hids = {t["hull_id"] for t in active_trucks}
        logged_active_hids = {c["hull_id"] for c in recent_crossings if c["hull_id"] in active_hids}
        rate = 0.0
        if total_active > 0:
            rate = round((len(logged_active_hids) / total_active) * 100, 1)
        return {
            "total_active_registered": total_active,
            "unique_active_logged": len(logged_active_hids),
            "utilization_rate": rate,
            "logged_trucks": list(logged_active_hids)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
