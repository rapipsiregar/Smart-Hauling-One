import time
import random
from datetime import datetime
from typing import List, Dict, Any, Optional

# Recent dispatches cache
_dispatches_log: List[Dict[str, Any]] = []

def trigger_crossing_alert(crossing: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    confidence = crossing.get("confidence", 100.0)
    warning_status = crossing.get("warning_status", "normal")
    if confidence >= 85.0 and warning_status != "cycle-discrepancy":
        return None
        
    alert_id = f"ALT-C-{int(time.time())}-{random.randint(100, 999)}"
    hull_id = crossing.get("hull_id", "Unknown")
    lane = crossing.get("lane", "Unknown")
    direction = crossing.get("direction", "inbound")
    
    if warning_status == "cycle-discrepancy":
        message = f"Cycle Discrepancy Alert: consecutive {direction} crossings for {hull_id} at {lane}"
        dispatches = [
            {
                "channel": "SMS",
                "recipient": "+62 811-555-0199 (Site Supervisor)",
                "status": "SENT",
                "payload": f"ALERT: OHT {hull_id} logged consecutive {direction} crossings without completing a full cycle."
            },
            {
                "channel": "Email",
                "recipient": "dispatch-alert@tunasinti.co.id",
                "status": "SENT",
                "payload": f"Subject: [SmartGate Alert] Cycle Discrepancy - {hull_id}\n\nBody: Vehicle {hull_id} passed consecutive {direction} checkpoints. Evidence logged under ID {crossing.get('id')}."
            }
        ]
    else:
        message = f"Low-confidence crossing ({confidence}%) for {hull_id} at {lane}"
        dispatches = [
            {
                "channel": "SMS",
                "recipient": "+62 811-555-0199 (Site Supervisor)",
                "status": "SENT",
                "payload": f"ALERT: OHT {hull_id} crossing at {lane} ({direction}) has low confidence ({confidence}%). Please verify."
            },
            {
                "channel": "Email",
                "recipient": "dispatch-alert@tunasinti.co.id",
                "status": "SENT",
                "payload": f"Subject: [SmartGate Alert] Low Confidence Detection - {hull_id}\n\nBody: Vehicle {hull_id} crossed {lane} {direction} with {confidence}% confidence. Evidence is logged under ID {crossing.get('id')}."
            }
        ]
        
    alert = {
        "alert_id": alert_id,
        "type": "dispatch_alert",
        "trigger_source": "crossing",
        "timestamp": datetime.utcnow().isoformat(),
        "severity": "medium",
        "message": message,
        "dispatches": dispatches
    }
    _dispatches_log.insert(0, alert)
    if len(_dispatches_log) > 20:
        _dispatches_log.pop()
    from backend import database
    for d in dispatches:
        try: database.log_dispatch("Crossing Alert", d["payload"], d["recipient"], d["channel"])
        except Exception: pass
    return alert

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
                "payload": f"Subject: [SmartGate Alert] Critical Telemetry Anomaly - {tower_id}\\n\\nBody: Skid tower {tower_id} at {location} has triggered status warning. Metrics:\\n- Battery: {battery}%\\n- Solar output: {solar_output}W."
            }
        ]
    }
    
    # Check if duplicate telemetry alert is already sent recently to prevent spamming
    for a in _dispatches_log[:3]:
        if a["trigger_source"] == "telemetry" and a["message"] == alert["message"]:
            return None

    _dispatches_log.insert(0, alert)
    if len(_dispatches_log) > 20:
        _dispatches_log.pop()
    for d in alert["dispatches"]:
        try: database.log_dispatch("Telemetry Alert", d["payload"], d["recipient"], d["channel"])
        except Exception: pass
    return alert

def get_dispatches_log() -> List[Dict[str, Any]]:
    return _dispatches_log

def trigger_compliance_warning_alert(contractor: str, recipient_email: str, payload: str) -> Optional[Dict[str, Any]]:
    alert_id = f"ALT-E-{int(time.time())}-{random.randint(100, 999)}"
    dispatches = [
        {
            "channel": "Email",
            "recipient": recipient_email,
            "status": "SENT",
            "payload": payload
        }
    ]
    alert = {
        "alert_id": alert_id,
        "type": "dispatch_alert",
        "trigger_source": "compliance",
        "timestamp": datetime.utcnow().isoformat(),
        "severity": "medium",
        "message": f"Contractor compliance warning email sent to {recipient_email} for {contractor}",
        "dispatches": dispatches
    }
    _dispatches_log.insert(0, alert)
    if len(_dispatches_log) > 20:
        _dispatches_log.pop()
    
    from backend import database
    for d in dispatches:
        try:
            database.log_dispatch("Compliance Warning", d["payload"], d["recipient"], d["channel"])
        except Exception:
            pass
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
    
    for a in _dispatches_log[:3]:
        if a["trigger_source"] == "latency" and a["message"] == alert["message"]:
            return None

    _dispatches_log.insert(0, alert)
    if len(_dispatches_log) > 20:
        _dispatches_log.pop()
    for d in alert["dispatches"]:
        try: database.log_dispatch("Latency Alert", d["payload"], d["recipient"], d["channel"])
        except Exception: pass
    return alert
