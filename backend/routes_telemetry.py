from fastapi import APIRouter, HTTPException
import time
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

router = APIRouter()

from datetime import datetime

_towers_cache = {}
_simulation_overrides = {}
_telemetry_history_logs = []
_latency_history = {}
_last_battery_diagnostic_time = 0
_last_checkin_times = {}

def get_current_towers_telemetry():
    from backend import database
    from backend.telemetry_simulator import simulated_towers
    global _last_battery_diagnostic_time
    now = time.time()
    if not _towers_cache or now - _towers_cache.get("last_refresh", 0) > 5:
        if now - _last_battery_diagnostic_time > 60:
            _last_battery_diagnostic_time = now
            try:
                import asyncio
                from backend.routes_admin_telemetry_diagnostic import run_battery_diagnostic
                loop = asyncio.get_running_loop()
                loop.create_task(run_battery_diagnostic())
                from backend.routes_telemetry_anomalies import get_telemetry_anomalies
                loop.create_task(asyncio.to_thread(get_telemetry_anomalies))
            except Exception:
                pass

        thresholds = database.get_thresholds()
        b_low = thresholds["battery_low"]
        s_low = thresholds["solar_low"]
        l_high = thresholds["latency_high"]
        
        _towers_cache["last_refresh"] = now
        _towers_cache["towers"] = []
        for tid, state in simulated_towers.items():
            t = state.copy()
            if tid in _simulation_overrides:
                for k, v in _simulation_overrides[tid].items():
                    if v is not None:
                        t[k] = v
            _towers_cache["towers"].append(t)
            
        from backend.signal_estimator import estimate_signal_metrics
        from backend import alerts_dispatcher
        from backend.websocket_manager import manager
        import asyncio
        for t in _towers_cache["towers"]:
            tid = t["id"]
            
            is_offline = False
            if t.get("status") == "offline" or now - _last_checkin_times.get(tid, now) > 300:
                is_offline = True
            else:
                _last_checkin_times[tid] = now
                
            if is_offline:
                t["connection_health"] = estimate_signal_metrics(0, True)
                t["status"] = "offline"
                t["battery"] = 0
                t["solar_output"] = 0
                t["latency"] = 999
                alert = alerts_dispatcher.trigger_offline_alert(tid, t["location"])
                if alert:
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(manager.broadcast(alert))
                    except Exception:
                        pass
                continue
                
            t["connection_health"] = estimate_signal_metrics(t.get("latency", 0), False)
                
            if tid not in _latency_history:
                _latency_history[tid] = []
            _latency_history[tid].append(t["latency"])
            if len(_latency_history[tid]) > 3:
                _latency_history[tid].pop(0)
                
            if len(_latency_history[tid]) == 3 and all(l > 400 for l in _latency_history[tid]):
                import logging
                logging.warning(f"Skid tower {tid} latency has exceeded 400ms across 3 consecutive status polls: {_latency_history[tid]}")
                alert = alerts_dispatcher.trigger_latency_alert(
                    tower_id=tid,
                    latency=t["latency"],
                    location=t["location"]
                )
                if alert:
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(manager.broadcast(alert))
                    except Exception:
                        pass

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
