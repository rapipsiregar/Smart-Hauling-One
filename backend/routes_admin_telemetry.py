from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from backend import routes_telemetry

router = APIRouter()

@router.get("/admin/telemetry-history")
def get_admin_telemetry_history(
    window: str = Query("24h", pattern="^(1h|6h|24h|7d)$"),
    tower_id: Optional[str] = None
):
    try:
        now = datetime.utcnow()
        if window == "1h":
            delta = timedelta(hours=1)
        elif window == "6h":
            delta = timedelta(hours=6)
        elif window == "7d":
            delta = timedelta(days=7)
        else:
            delta = timedelta(hours=24)
            
        start_time = now - delta
        
        # Access routes_telemetry._telemetry_history_logs
        logs = routes_telemetry._telemetry_history_logs
        
        grouped = {}
        for entry in logs:
            try:
                # Handle trailing Z or parse datetime
                ts_str = entry["timestamp"]
                if ts_str.endswith("Z"): ts_str = ts_str[:-1]
                ts = datetime.fromisoformat(ts_str)
                if ts >= start_time:
                    tid = entry["tower_id"]
                    if tower_id and tid != tower_id:
                        continue
                    if tid not in grouped:
                        grouped[tid] = []
                    
                    solar_output = entry.get("solar_output", 0)
                    charging_current = entry.get("charging_current") or round(solar_output / 12.0, 2)
                    
                    grouped[tid].append({
                        "timestamp": entry["timestamp"],
                        "battery": entry["battery"],
                        "solar_output": solar_output,
                        "charging_current": charging_current,
                        "latency": entry["latency"]
                    })
            except Exception as e:
                pass
                
        return {"status": "success", "window": window, "history": grouped}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/admin/telemetry-purge")
def purge_telemetry(older_than_days: float = Query(7.0)):
    try:
        now = datetime.utcnow()
        cutoff = now - timedelta(days=older_than_days)
        
        original_count = len(routes_telemetry._telemetry_history_logs)
        
        filtered_logs = []
        for entry in routes_telemetry._telemetry_history_logs:
            try:
                ts_str = entry["timestamp"]
                if ts_str.endswith("Z"): ts_str = ts_str[:-1]
                ts = datetime.fromisoformat(ts_str)
                if ts >= cutoff:
                    filtered_logs.append(entry)
            except Exception:
                # If timestamp is unparseable, keep it or skip it; let's keep it to be safe
                filtered_logs.append(entry)
                
        routes_telemetry._telemetry_history_logs = filtered_logs
        purged_count = original_count - len(filtered_logs)
        
        from backend.database import get_db_connection
        conn = get_db_connection()
        try:
            conn.execute(
                "INSERT INTO audit_logs (timestamp, action, details, operator) VALUES (?, ?, ?, ?)",
                (now.isoformat(), "PURGE_TELEMETRY", f"Purged {purged_count} telemetry records older than {older_than_days} days.", "admin")
            )
            conn.commit()
        finally:
            conn.close()
            
        return {
            "status": "success",
            "purged_count": purged_count,
            "remaining_count": len(filtered_logs)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
