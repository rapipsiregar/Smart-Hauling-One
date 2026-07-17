import asyncio
import time
import random
from datetime import datetime
from backend import database
from backend.routes_telemetry import _telemetry_history_logs, _simulation_overrides, _last_checkin_times
from backend.websocket_manager import manager
from backend import alerts_dispatcher

simulated_towers = {
    "Tower-Alpha": {
        "id": "Tower-Alpha",
        "location": "North Checkpoint",
        "battery": 85.0,
        "solar_output": 120.0,
        "latency": 40,
        "status": "online"
    },
    "Tower-Beta": {
        "id": "Tower-Beta",
        "location": "South Gate",
        "battery": 92.0,
        "solar_output": 95.0,
        "latency": 60,
        "status": "online"
    },
    "Tower-Gamma": {
        "id": "Tower-Gamma",
        "location": "Main Portal",
        "battery": 45.0,
        "solar_output": 10.0,
        "latency": 150,
        "status": "online"
    }
}

async def start_telemetry_simulator():
    """Background simulator task updating battery/solar cycles every 10 seconds"""
    while True:
        try:
            await asyncio.sleep(10.0)
            now = time.time()
            thresholds = database.get_thresholds()
            b_low = thresholds["battery_low"]
            s_low = thresholds["solar_low"]
            l_high = thresholds["latency_high"]
            
            # 10 minutes daytime / 10 minutes nighttime cycle simulation
            minutes = (int(now) // 60) % 20
            is_daytime = minutes < 10
            
            for tid, state in simulated_towers.items():
                if tid in _simulation_overrides:
                    continue
                    
                # Solar array output fluctuations
                if is_daytime:
                    base_solar = 100.0 if tid != "Tower-Gamma" else 30.0
                    state["solar_output"] = max(0.0, round(base_solar + random.uniform(-15.0, 20.0), 2))
                else:
                    state["solar_output"] = max(0.0, round(random.uniform(0.0, 3.0), 2))
                
                # Battery charging/discharging progression
                if state["solar_output"] > 40.0:
                    state["battery"] = min(100.0, round(state["battery"] + random.uniform(0.15, 0.45), 2))
                else:
                    state["battery"] = max(5.0, round(state["battery"] - random.uniform(0.05, 0.25), 2))
                
                # Latency drift simulation
                state["latency"] = max(5, int(state["latency"] + random.choice([-8, -4, 0, 4, 8])))
                
                # Evaluate warning status
                if state["battery"] < b_low or state["solar_output"] < s_low or state["latency"] > l_high:
                    state["status"] = "warning"
                else:
                    state["status"] = "online"
            
            # Record current states to telemetry logs
            ts = datetime.utcnow().isoformat()
            for tid, state in simulated_towers.items():
                active_state = state.copy()
                if tid in _simulation_overrides:
                    for k, v in _simulation_overrides[tid].items():
                        if v is not None: active_state[k] = v
                
                _telemetry_history_logs.insert(0, {
                    "timestamp": ts,
                    "tower_id": tid,
                    "battery": active_state["battery"],
                    "solar_output": active_state["solar_output"],
                    "charging_current": round(active_state["solar_output"] / 12.0, 2),
                    "latency": active_state["latency"]
                })
            
            if len(_telemetry_history_logs) > 300:
                del _telemetry_history_logs[300:]
                
        except Exception as e:
            import logging
            logging.error(f"Error in telemetry simulator loop: {e}")
