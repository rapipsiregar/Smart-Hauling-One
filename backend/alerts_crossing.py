import time
import random
from datetime import datetime
from typing import Dict, Any, Optional

def trigger_crossing_alert(crossing: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    from backend import database
    thresholds = database.get_thresholds()
    conf_min = thresholds.get("ocr_confidence_min", 85.0)
    
    confidence = crossing.get("confidence", 100.0)
    warning_status = crossing.get("warning_status", "normal")
    
    if confidence >= conf_min and warning_status != "cycle-discrepancy":
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
    
    from backend import alerts_dispatcher
    log_cache = alerts_dispatcher.get_dispatches_log()
    log_cache.insert(0, alert)
    if len(log_cache) > 20:
        log_cache.pop()
        
    for d in dispatches:
        try: database.log_dispatch("Crossing Alert", d["payload"], d["recipient"], d["channel"])
        except Exception: pass
    return alert
