from fastapi import APIRouter, HTTPException
from datetime import datetime
from collections import defaultdict
from backend import database
from backend.routes_telemetry import _telemetry_history_logs
from backend.reports_compliance_logic import parse_ts

router = APIRouter(prefix="/admin")

_anomalies_cache = {
    "data": None,
    "last_fetched": 0
}

@router.get("/telemetry/anomalies")
def get_telemetry_anomalies():
    global _anomalies_cache
    import time
    now = time.time()
    if _anomalies_cache["data"] is not None and now - _anomalies_cache["last_fetched"] < 15.0:
        return _anomalies_cache["data"]
    try:
        # Group raw logs by tower and hour
        tower_hourly_logs = defaultdict(lambda: defaultdict(list))
        
        for entry in _telemetry_history_logs:
            try:
                tid = entry["tower_id"]
                dt = parse_ts(entry["timestamp"])
                # Key: hourly bucket
                hour_key = dt.replace(minute=0, second=0, microsecond=0)
                tower_hourly_logs[tid][hour_key].append(entry)
            except Exception:
                continue
                
        anomalies = []
        
        # Read existing audit logs to prevent duplicate logging
        try:
            existing_audits = database.get_all_audits()
        except Exception:
            existing_audits = []
            
        def is_already_logged(details_sub):
            for aud in existing_audits:
                if aud.get("action") == "telemetry_anomaly" and details_sub in aud.get("details", ""):
                    return True
            return False

        for tid, hourly_buckets in tower_hourly_logs.items():
            # Sort buckets chronologically
            sorted_hours = sorted(hourly_buckets.keys())
            
            # Compute averages per hour
            hourly_averages = []
            for h in sorted_hours:
                records = hourly_buckets[h]
                avg_battery = sum(r["battery"] for r in records) / len(records)
                avg_solar = sum(r["solar_output"] for r in records) / len(records)
                hourly_averages.append({
                    "hour": h,
                    "avg_battery": avg_battery,
                    "avg_solar": avg_solar
                })
                
            # Scan chronological sequence for anomalies
            for i in range(1, len(hourly_averages)):
                prev = hourly_averages[i - 1]
                curr = hourly_averages[i]
                
                h_dt = curr["hour"]
                is_daylight = 8 <= h_dt.hour < 16
                
                battery_drop = prev["avg_battery"] - curr["avg_battery"]
                
                anomaly_type = None
                details = ""
                
                # 1. High Battery Discharge (> 5% drop in 1 hour)
                if battery_drop > 5.0:
                    anomaly_type = "High Battery Discharge"
                    details = f"Tower {tid} battery dropped rapidly by {battery_drop:.1f}% in one hour (from {prev['avg_battery']:.1f}% down to {curr['avg_battery']:.1f}%)."
                
                # 2. Charging Failure (Daylight, Low Solar, Battery Dropping)
                elif is_daylight and curr["avg_solar"] < 20.0 and battery_drop > 0.5:
                    anomaly_type = "Charging Failure"
                    details = f"Tower {tid} reports low solar charging ({curr['avg_solar']:.1f}W) during daylight (hour {h_dt.hour}:00) while battery dropped by {battery_drop:.1f}%."
                
                # 3. Controller Failure (High Solar, Battery Dropping/Not Charging)
                elif curr["avg_solar"] > 40.0 and battery_drop > 0.5:
                    anomaly_type = "Controller Failure"
                    details = f"Tower {tid} reports active solar panel output ({curr['avg_solar']:.1f}W) but battery continues to drain by {battery_drop:.1f}%."
                    
                if anomaly_type:
                    anomaly_time_str = h_dt.strftime("%Y-%m-%d %H:00")
                    audit_details = f"[{anomaly_time_str}] {details}"
                    
                    # Log to SQLite audit trail if not already logged
                    if not is_already_logged(audit_details):
                        try:
                            database.log_audit("telemetry_anomaly", audit_details, "system")
                        except Exception:
                            pass
                            
                    anomalies.append({
                        "tower_id": tid,
                        "type": anomaly_type,
                        "timestamp": h_dt.isoformat(),
                        "details": details
                    })
                    
        res = {
            "status": "success",
            "anomalies": anomalies
        }
        _anomalies_cache["data"] = res
        _anomalies_cache["last_fetched"] = now
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
