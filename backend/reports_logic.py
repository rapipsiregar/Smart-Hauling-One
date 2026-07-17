from datetime import datetime, timedelta
from backend import database
from backend.routes_telemetry import get_current_towers_telemetry
from backend.reports_compliance_logic import calculate_contractor_compliance, calculate_hourly_compliance

def parse_ts(ts):
    if ts.endswith("Z"): ts = ts[:-1]
    if "." in ts:
        parts = ts.split(".")
        parts[1] = parts[1][:6]
        ts = ".".join(parts)
    return datetime.fromisoformat(ts)

def calculate_shift_summary():
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
    
    thresholds = database.get_thresholds()
    conf_min = thresholds.get("ocr_confidence_min", 85.0)
    
    for c in crossings:
        hid = c["hull_id"]
        if c.get("warning_status") == "low-confidence" or c["confidence"] < conf_min:
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
        
        from backend.routes_telemetry import _latency_history
        tid = t["id"]
        if tid in _latency_history:
            hist = _latency_history[tid]
            if len(hist) == 3 and all(l > 400 for l in hist):
                discrepancies.append({
                    "timestamp": datetime.utcnow().isoformat(), "hull_id": tid, "lane": t["location"],
                    "type": "Critical Skid Latency Warning", "severity": "high",
                    "details": f"Skid tower latency has exceeded 400ms across 3 consecutive polls: {t['latency']}ms."
                })
                
    active_hours = 1.0
    if crossings:
        try:
            timestamps = [parse_ts(c["timestamp"]) for c in crossings]
            diff = (max(timestamps) - min(timestamps)).total_seconds() / 3600.0
            if diff > 0.1: active_hours = diff
        except: pass

    contractor_cycles = {}
    for hid, cycles in completed_ritase.items():
        truck = next((t for t in trucks if t["hull_id"] == hid), None)
        contractor = truck["contractor"] if truck else "Ad-hoc Contractor"
        contractor_cycles[contractor] = contractor_cycles.get(contractor, 0) + cycles

    try:
        day_hours = {}
        for row in get_all_daily_stats():
            c = row["contractor"]
            contractor_cycles[c] = contractor_cycles.get(c, 0) + row["cycles"]
            day_hours[row["date"]] = max(day_hours.get(row["date"], 0.0), row.get("active_hours", 24.0))
        active_hours += sum(day_hours.values())
    except:
        pass

    now = datetime.utcnow()
    day_ago = now - timedelta(days=1)
    recent_crossings = []
    for c in crossings:
        try:
            dt = parse_ts(c["timestamp"])
            if dt >= day_ago:
                recent_crossings.append(c)
        except:
            pass
    recent_hids = {c["hull_id"] for c in recent_crossings}

    compliance = calculate_contractor_compliance(trucks, contractor_cycles, active_hours, recent_hids)
    hourly_compliance = calculate_hourly_compliance(truck_crossings, trucks)

    # Flag subcontractor compliance progress timeline anomaly (stays below 50% for 3 consecutive hours)
    contractor_targets = database.get_contractor_targets()
    for contractor in contractor_targets.keys():
        consecutive_low = 0
        consecutive_start = None
        for item in hourly_compliance:
            rate = item["rates"].get(contractor, 0.0)
            if rate < 50.0:
                if consecutive_low == 0:
                    consecutive_start = item["hour"]
                consecutive_low += 1
                if consecutive_low >= 3:
                    discrepancies.append({
                        "timestamp": datetime.utcnow().isoformat(),
                        "hull_id": contractor,
                        "lane": "N/A",
                        "type": "Contractor Timeline Anomaly",
                        "severity": "high",
                        "details": f"Contractor {contractor} compliance remained under 50% for 3 consecutive hours (starting at {consecutive_start})."
                    })
                    break
            else:
                consecutive_low = 0

    return {
        "completed_ritase": completed_ritase, "crossings_per_truck": crossings_count,
        "shift_distribution": shift_slots, "date_distribution": date_distribution, 
        "discrepancies": discrepancies, "compliance": compliance,
        "hourly_compliance": hourly_compliance
    }

def calculate_class_distribution() -> dict:
    crossings = [c for c in database.get_all_crossings() if not c.get("is_duplicate")]
    distribution = {
        "Dump Truck": 0,
        "Light Vehicle": 0,
        "Excavator": 0
    }
    for c in crossings:
        v_class = c.get("vehicle_class", "Dump Truck")
        if v_class not in distribution:
            distribution[v_class] = 0
        distribution[v_class] += 1
    return {
        "status": "success",
        "distribution": distribution,
        "total_passages": sum(distribution.values())
    }
