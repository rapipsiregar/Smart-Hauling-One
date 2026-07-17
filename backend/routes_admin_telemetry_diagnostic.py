from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from backend.routes_telemetry import _telemetry_history_logs
from backend.alerts_telemetry import trigger_battery_drain_alert
from backend.websocket_manager import manager

router = APIRouter()

@router.post("/telemetry/battery-diagnostic")
async def run_battery_diagnostic():
    try:
        tower_logs = {}
        for entry in _telemetry_history_logs:
            tid = entry["tower_id"]
            tower_logs.setdefault(tid, []).append(entry)
            
        def parse_ts(ts):
            if ts.endswith("Z"): ts = ts[:-1]
            if "." in ts:
                parts = ts.split(".")
                parts[1] = parts[1][:6]
                ts = ".".join(parts)
            return datetime.fromisoformat(ts)
            
        now = datetime.utcnow()
        day_ago = now - timedelta(hours=24)
        
        triggered_alerts = []
        
        for tid, entries in tower_logs.items():
            recent_entries = []
            for e in entries:
                try:
                    dt = parse_ts(e["timestamp"])
                    if dt >= day_ago:
                        recent_entries.append((dt, e["battery"]))
                except Exception:
                    pass
            
            if len(recent_entries) < 2:
                continue
                
            recent_entries.sort(key=lambda x: x[0])
            
            night_entries = []
            for dt, battery in recent_entries:
                if dt.hour >= 18 or dt.hour < 6:
                    night_entries.append((dt, battery))
                    
            if len(night_entries) < 2:
                continue
                
            start_dt, start_bat = night_entries[0]
            end_dt, end_bat = night_entries[-1]
            
            duration_hours = (end_dt - start_dt).total_seconds() / 3600.0
            if duration_hours > 0.5:
                drain = start_bat - end_bat
                hourly_drain = drain / duration_hours
                
                if hourly_drain > 5.0:
                    from backend.telemetry_simulator import simulated_towers
                    loc = simulated_towers.get(tid, {}).get("location", "Unknown Location")
                    
                    alert = trigger_battery_drain_alert(
                        tower_id=tid,
                        hourly_drain=hourly_drain,
                        start_battery=start_bat,
                        end_battery=end_bat,
                        location=loc
                    )
                    if alert:
                        triggered_alerts.append(alert)
                        try:
                            await manager.broadcast(alert)
                        except Exception:
                            pass
                            
        return {
            "status": "success",
            "analyzed_towers_count": len(tower_logs),
            "triggered_alerts": triggered_alerts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
