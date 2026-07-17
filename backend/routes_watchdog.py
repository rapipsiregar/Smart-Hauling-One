import time
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from backend.routes_telemetry import _telemetry_history_logs
from backend.websocket_manager import manager
import asyncio

router = APIRouter(prefix="/telemetry")

TOWER_LOCATIONS = {
    "Tower-Alpha": "North Crossing Gate",
    "Tower-Beta": "South Inpit Access",
    "Tower-Gamma": "Main Processing Plant"
}

@router.post("/watchdog/check")
async def check_network_watchdog():
    try:
        now = datetime.utcnow()
        five_minutes_ago = now - timedelta(minutes=5)
        
        from backend.alerts_dispatcher import trigger_watchdog_degradation_alert
        
        checked_towers = []
        triggered_alerts = []
        
        for tid, location in TOWER_LOCATIONS.items():
            tower_logs = []
            for log in _telemetry_history_logs:
                try:
                    log_ts = datetime.fromisoformat(log["timestamp"].replace("Z", "+00:00"))
                    log_ts_naive = log_ts.replace(tzinfo=None)
                    if log["tower_id"] == tid and log_ts_naive >= five_minutes_ago:
                        tower_logs.append(log)
                except Exception:
                    continue
            
            if not tower_logs:
                continue
                
            latencies = [log["latency"] for log in tower_logs if log["latency"] < 900]
            if not latencies:
                continue
                
            avg_latency = sum(latencies) / len(latencies)
            baseline = 100.0
            degradation_pct = ((avg_latency - baseline) / baseline) * 100.0
            
            status = "normal"
            alert = None
            if degradation_pct > 15.0:
                status = "degraded"
                alert = trigger_watchdog_degradation_alert(
                    tower_id=tid,
                    avg_latency=avg_latency,
                    degradation_pct=degradation_pct,
                    location=location
                )
                if alert:
                    triggered_alerts.append(alert)
                    try:
                        await manager.broadcast(alert)
                    except Exception:
                        pass
            
            checked_towers.append({
                "tower_id": tid,
                "avg_latency": round(avg_latency, 1),
                "degradation_pct": round(max(0.0, degradation_pct), 1),
                "status": status
            })
            
        return {
            "status": "success",
            "checked_towers": checked_towers,
            "triggered_alerts": triggered_alerts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
