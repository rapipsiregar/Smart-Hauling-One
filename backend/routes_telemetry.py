from fastapi import APIRouter, HTTPException
import time
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

router = APIRouter()

from datetime import datetime

_towers_cache = {}
_simulation_overrides = {}
_telemetry_history_logs = []

def get_current_towers_telemetry():
    import random
    from backend import database
    now = time.time()
    if not _towers_cache or now - _towers_cache.get("last_refresh", 0) > 5:
        thresholds = database.get_thresholds()
        b_low = thresholds["battery_low"]
        s_low = thresholds["solar_low"]
        l_high = thresholds["latency_high"]
        gamma_battery = random.randint(25, 48)
        gamma_solar = random.randint(2, 15)
        gamma_latency = random.randint(220, 245)
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
                "latency": gamma_latency,
                "status": "warning" if (gamma_battery < b_low or gamma_solar < s_low or gamma_latency > l_high) else "online"
            }
        ]
        for t in _towers_cache["towers"]:
            tid = t["id"]
            if tid in _simulation_overrides:
                for k, v in _simulation_overrides[tid].items():
                    if v is not None:
                        t[k] = v
                        
        # Check anomalies and dispatch mock alerts
        from backend import alerts_dispatcher
        from backend.websocket_manager import manager
        import asyncio
        for t in _towers_cache["towers"]:
            if t["battery"] < b_low or t["solar_output"] < s_low or t["latency"] > l_high:
                t["status"] = "warning"
                alert = alerts_dispatcher.trigger_telemetry_alert(
                    tower_id=t["id"],
                    battery=t["battery"],
                    solar_output=t["solar_output"],
                    location=t["location"]
                )
                if alert:
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(manager.broadcast(alert))
                    except Exception:
                        pass
        # Log to history
        ts = datetime.utcnow().isoformat()
        for t in _towers_cache["towers"]:
            _telemetry_history_logs.insert(0, {
                "timestamp": ts,
                "tower_id": t["id"],
                "battery": t["battery"],
                "solar_output": t["solar_output"],
                "latency": t["latency"]
            })
        if len(_telemetry_history_logs) > 300:
            del _telemetry_history_logs[300:]
    return _towers_cache["towers"]

@router.get("/telemetry/towers")
def get_towers_telemetry():
    return get_current_towers_telemetry()

class SimulateReq(BaseModel):
    tower_id: str
    battery: Optional[int] = None
    solar_output: Optional[int] = None
    latency: Optional[int] = None
    status: Optional[str] = None

@router.post("/telemetry/simulate")
def simulate_telemetry(req: SimulateReq):
    tid = req.tower_id
    if tid not in ["Tower-Alpha", "Tower-Beta", "Tower-Gamma"]:
        raise HTTPException(status_code=400, detail="Invalid tower ID")
    _simulation_overrides[tid] = {k: v for k, v in req.model_dump().items() if v is not None}
    _towers_cache.clear()
    return {"status": "success", "overrides": _simulation_overrides[tid]}

@router.post("/telemetry/reset")
def reset_telemetry():
    _simulation_overrides.clear()
    _towers_cache.clear()
    return {"status": "success"}

@router.get("/admin/alert-dispatches")
def get_alert_dispatches():
    from backend import alerts_dispatcher
    return alerts_dispatcher.get_dispatches_log()

from backend import database

class ThresholdsReq(BaseModel):
    battery_low: Optional[float] = None
    solar_low: Optional[float] = None
    latency_high: Optional[float] = None

@router.get("/telemetry/thresholds")
def get_telemetry_thresholds():
    return database.get_thresholds()

@router.post("/telemetry/thresholds")
def post_telemetry_thresholds(req: ThresholdsReq):
    try:
        payload = {}
        if req.battery_low is not None: payload["battery_low"] = req.battery_low
        if req.solar_low is not None: payload["solar_low"] = req.solar_low
        if req.latency_high is not None: payload["latency_high"] = req.latency_high
        database.set_thresholds(payload)
        return {"status": "success", "thresholds": database.get_thresholds()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/telemetry/history")
def get_telemetry_history():
    return _telemetry_history_logs
