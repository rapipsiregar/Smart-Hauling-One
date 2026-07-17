import time
import random
from datetime import datetime
from typing import Dict, Any, Optional

def trigger_telemetry_alert(tower_id: str, battery: int, solar_output: int, location: str) -> Optional[Dict[str, Any]]:
    from backend import database
    thresholds = database.get_thresholds()
    b_low = thresholds["battery_low"]
    s_low = thresholds["solar_low"]
    if battery >= b_low and solar_output >= s_low:
        return None
        
    reasons = []
    if battery < b_low:
        reasons.append(f"Low Battery ({battery}%)")
    if solar_output < s_low:
        reasons.append(f"Low Solar Output ({solar_output}W)")
    reason_str = " & ".join(reasons)
    
    alert_id = f"ALT-T-{int(time.time())}-{random.randint(100, 999)}"
    
    alert = {
        "alert_id": alert_id,
        "type": "dispatch_alert",
        "trigger_source": "telemetry",
        "timestamp": datetime.utcnow().isoformat(),
        "severity": "high",
        "message": f"Skid Telemetry Alert: {tower_id} - {reason_str}",
        "dispatches": [
            {
                "channel": "SMS",
                "recipient": "+62 811-555-0210 (Maintenance Lead)",
                "status": "SENT",
                "payload": f"CRITICAL ALERT: Skid tower {tower_id} at {location} reports {reason_str}. Immediate inspection required."
            },
            {
                "channel": "Email",
                "recipient": "maintenance-alerts@tunasinti.co.id",
                "status": "SENT",
                "payload": f"Subject: [SmartGate Alert] Critical Telemetry Anomaly - {tower_id}\n\nBody: Skid tower {tower_id} at {location} has triggered status warning. Metrics:\n- Battery: {battery}%\n- Solar output: {solar_output}W."
            }
        ]
    }
    
    from backend import alerts_dispatcher
    log_cache = alerts_dispatcher.get_dispatches_log()
    for a in log_cache[:3]:
        if a["trigger_source"] == "telemetry" and a["message"] == alert["message"]:
            return None

    log_cache.insert(0, alert)
    if len(log_cache) > 20:
        log_cache.pop()
    for d in alert["dispatches"]:
        try: database.log_dispatch("Telemetry Alert", d["payload"], d["recipient"], d["channel"])
        except Exception: pass
    return alert

def trigger_latency_alert(tower_id: str, latency: int, location: str) -> Optional[Dict[str, Any]]:
    from backend import database
    alert_id = f"ALT-L-{int(time.time())}-{random.randint(100, 999)}"
    
    alert = {
        "alert_id": alert_id,
        "type": "dispatch_alert",
        "trigger_source": "latency",
        "timestamp": datetime.utcnow().isoformat(),
        "severity": "high",
        "message": f"Skid Latency Warning: {tower_id} latency exceeded 400ms across 3 consecutive polls ({latency}ms)",
        "dispatches": [
            {
                "channel": "SMS",
                "recipient": "+62 811-555-0210 (Maintenance Lead)",
                "status": "SENT",
                "payload": f"CRITICAL ALERT: Skid tower {tower_id} at {location} has latency exceeding 400ms across 3 polls: {latency}ms."
            },
            {
                "channel": "Email",
                "recipient": "maintenance-alerts@tunasinti.co.id",
                "status": "SENT",
                "payload": f"Subject: [SmartGate Alert] Critical Skid Latency - {tower_id}\n\nBody: Skid tower {tower_id} at {location} reports high latency of {latency}ms across 3 consecutive status polls."
            }
        ]
    }
    
    from backend import alerts_dispatcher
    log_cache = alerts_dispatcher.get_dispatches_log()
    for a in log_cache[:3]:
        if a["trigger_source"] == "latency" and a["message"] == alert["message"]:
            return None

    log_cache.insert(0, alert)
    if len(log_cache) > 20:
        log_cache.pop()
    for d in alert["dispatches"]:
        try: database.log_dispatch("Latency Alert", d["payload"], d["recipient"], d["channel"])
        except Exception: pass
    return alert

def trigger_offline_alert(tower_id: str, location: str) -> Optional[Dict[str, Any]]:
    from backend import database
    alert_id = f"ALT-O-{int(time.time())}-{random.randint(100, 999)}"
    alert = {
        "alert_id": alert_id,
        "type": "dispatch_alert",
        "trigger_source": "offline",
        "timestamp": datetime.utcnow().isoformat(),
        "severity": "critical",
        "message": f"Skid Tower Offline: {tower_id} has not reported telemetry for >5 minutes",
        "dispatches": [
            {
                "channel": "SMS",
                "recipient": "+62 811-555-0210 (Maintenance Lead)",
                "status": "SENT",
                "payload": f"CRITICAL: Skid tower {tower_id} at {location} is OFFLINE (no telemetry >5m). Urgent check required."
            },
            {
                "channel": "Email",
                "recipient": "maintenance-alerts@tunasinti.co.id",
                "status": "SENT",
                "payload": f"Subject: [SmartGate Alert] Skid Tower Offline Notification - {tower_id}\n\nBody: Skid tower {tower_id} at {location} went offline. No telemetry reported for over 5 minutes. Please dispatch maintenance."
            }
        ]
    }
    from backend import alerts_dispatcher
    log_cache = alerts_dispatcher.get_dispatches_log()
    for a in log_cache[:3]:
        if a["trigger_source"] == "offline" and a["message"] == alert["message"]:
            return None
    log_cache.insert(0, alert)
    if len(log_cache) > 20:
        log_cache.pop()
    for d in alert["dispatches"]:
        try: database.log_dispatch("Tower Offline Alert", d["payload"], d["recipient"], d["channel"])
        except Exception: pass
    return alert

def trigger_watchdog_degradation_alert(tower_id: str, avg_latency: float, degradation_pct: float, location: str) -> Optional[Dict[str, Any]]:
    from backend import database
    alert_id = f"ALT-WD-{int(time.time())}-{random.randint(100, 999)}"
    alert = {
        "alert_id": alert_id,
        "type": "dispatch_alert",
        "trigger_source": "watchdog",
        "timestamp": datetime.utcnow().isoformat(),
        "severity": "medium",
        "message": f"Watchdog Alert: {tower_id} degradation detected - latency {avg_latency:.1f}ms exceeds baseline by {degradation_pct:.1f}%",
        "dispatches": [
            {
                "channel": "SMS",
                "recipient": "+62 811-555-0210 (Maintenance Lead)",
                "status": "SENT",
                "payload": f"Watchdog Warning: Skid {tower_id} at {location} network degraded by {degradation_pct:.1f}% (Avg Latency: {avg_latency:.1f}ms)."
            },
            {
                "channel": "Email",
                "recipient": "maintenance-alerts@tunasinti.co.id",
                "status": "SENT",
                "payload": f"Subject: [SmartGate Watchdog] Network Degradation Warning - {tower_id}\n\nBody: Skid {tower_id} at {location} has average latency of {avg_latency:.1f}ms, showing a network degradation of {degradation_pct:.1f}% over the past 5 minutes."
            }
        ]
    }
    from backend import alerts_dispatcher
    log_cache = alerts_dispatcher.get_dispatches_log()
    for a in log_cache[:3]:
        if a["trigger_source"] == "watchdog" and a["message"] == alert["message"]:
            return None
    log_cache.insert(0, alert)
    if len(log_cache) > 20:
        log_cache.pop()
    for d in alert["dispatches"]:
        try: database.log_dispatch("Watchdog Alert", d["payload"], d["recipient"], d["channel"])
        except Exception: pass
    return alert

def trigger_battery_drain_alert(tower_id: str, hourly_drain: float, start_battery: float, end_battery: float, location: str) -> Optional[Dict[str, Any]]:
    from backend import database
    alert_id = f"ALT-BD-{int(time.time())}-{random.randint(100, 999)}"
    alert = {
        "alert_id": alert_id,
        "type": "dispatch_alert",
        "trigger_source": "battery_drain",
        "timestamp": datetime.utcnow().isoformat(),
        "severity": "high",
        "message": f"Battery Anomaly Alert: {tower_id} night shift hourly battery drain rate ({hourly_drain:.2f}%) exceeds 5% threshold (Start: {start_battery}%, End: {end_battery}%)",
        "dispatches": [
            {
                "channel": "SMS",
                "recipient": "+62 811-555-0210 (Maintenance Lead)",
                "status": "SENT",
                "payload": f"BATTERY DRAIN ANOMALY: Skid {tower_id} at {location} night drain is {hourly_drain:.2f}% per hour (Start: {start_battery}%, End: {end_battery}%)."
            },
            {
                "channel": "Email",
                "recipient": "maintenance-alerts@tunasinti.co.id",
                "status": "SENT",
                "payload": f"Subject: [SmartGate Telemetry] Battery Drain Anomaly - {tower_id}\n\nBody: Skid {tower_id} at {location} has reported abnormally high battery discharge during the night shift. Hourly drain is {hourly_drain:.2f}% (Start: {start_battery}%, End: {end_battery}%)."
            }
        ]
    }
    from backend import alerts_dispatcher
    log_cache = alerts_dispatcher.get_dispatches_log()
    for a in log_cache[:3]:
        if a["trigger_source"] == "battery_drain" and a["message"] == alert["message"]:
            return None
    log_cache.insert(0, alert)
    if len(log_cache) > 20:
        log_cache.pop()
    for d in alert["dispatches"]:
        try: database.log_dispatch("Battery Drain Alert", d["payload"], d["recipient"], d["channel"])
        except Exception: pass
    return alert


