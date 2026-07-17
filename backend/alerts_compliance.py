import time
import random
from datetime import datetime
from typing import Dict, Any, Optional

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
    from backend import alerts_dispatcher
    log_cache = alerts_dispatcher.get_dispatches_log()
    log_cache.insert(0, alert)
    if len(log_cache) > 20:
        log_cache.pop()
    
    from backend import database
    for d in dispatches:
        try:
            database.log_dispatch("Compliance Warning", d["payload"], d["recipient"], d["channel"])
        except Exception:
            pass
    return alert

def trigger_contractor_compliance_alert(contractor: str, compliance_pct: float, hourly_rate: float, target: float) -> Optional[Dict[str, Any]]:
    alert_id = f"ALT-CC-{int(time.time())}-{random.randint(100, 999)}"
    message = f"Critical Compliance Drop: Contractor {contractor} compliance has dropped below 80% (Current: {compliance_pct}%)"
    dispatches = [
        {
            "channel": "SMS",
            "recipient": "+62 811-555-0199 (Site Supervisor)",
            "status": "SENT",
            "payload": f"ALERT: Contractor {contractor} target compliance has dropped to {compliance_pct}% (Hourly Rate: {hourly_rate} vs Target: {target})."
        },
        {
            "channel": "Email",
            "recipient": "dispatch-alert@tunasinti.co.id",
            "status": "SENT",
            "payload": f"Subject: [SmartGate Alert] Critical Contractor Compliance Drop - {contractor}\n\nDear Team,\n\nSubcontractor '{contractor}' target compliance has dropped below the critical 80% threshold.\n\n- Current Compliance: {compliance_pct}%\n- Hourly Rate: {hourly_rate} ritase/hr\n- Target Expected: {target} ritase/hr\n\nPlease coordinate with the subcontractor representative to resolve haulage bottlenecks."
        }
    ]
    alert = {
        "alert_id": alert_id,
        "type": "dispatch_alert",
        "trigger_source": "compliance",
        "timestamp": datetime.utcnow().isoformat(),
        "severity": "critical",
        "message": message,
        "dispatches": dispatches
    }
    
    from backend import alerts_dispatcher
    log_cache = alerts_dispatcher.get_dispatches_log()
    for a in log_cache[:5]:
        if a["trigger_source"] == "compliance" and a["message"] == message:
            return None
            
    log_cache.insert(0, alert)
    if len(log_cache) > 20:
        log_cache.pop()
        
    from backend import database
    for d in dispatches:
        try:
            database.log_dispatch("Compliance Alert", d["payload"], d["recipient"], d["channel"])
        except Exception:
            pass
    return alert

def trigger_oht_overload_alert(hull_id: str, contractor: str, ritase: int, shift_name: str) -> Optional[Dict[str, Any]]:
    alert_id = f"ALT-OV-{int(time.time())}-{random.randint(100, 999)}"
    message = f"OHT Cycle Limit Warning: Vehicle {hull_id} ({contractor}) exceeded shift cycle threshold with {ritase} ritase in shift {shift_name}"
    dispatches = [
        {
            "channel": "SMS",
            "recipient": "+62 811-555-0199 (Site Supervisor)",
            "status": "SENT",
            "payload": f"WARNING: Vehicle {hull_id} ({contractor}) reports {ritase} ritase in shift {shift_name}. Possible double-entry detected."
        },
        {
            "channel": "Email",
            "recipient": "dispatch-alert@tunasinti.co.id",
            "status": "SENT",
            "payload": f"Subject: [SmartGate Alert] OHT Cycle Exceedance Warning - {hull_id}\n\nDear Team,\n\nOHT vehicle {hull_id} operated by subcontractor '{contractor}' has recorded {ritase} completed ritase in the current shift ({shift_name}). This exceeds the shift threshold of 20 cycles.\n\nPlease check for potential data double-entries or duplicate crossing records."
        }
    ]
    alert = {
        "alert_id": alert_id,
        "type": "dispatch_alert",
        "trigger_source": "vehicle_load",
        "timestamp": datetime.utcnow().isoformat(),
        "severity": "high",
        "message": message,
        "dispatches": dispatches
    }
    
    from backend import alerts_dispatcher
    log_cache = alerts_dispatcher.get_dispatches_log()
    for a in log_cache[:5]:
        if a["trigger_source"] == "vehicle_load" and a["message"] == message:
            return None
            
    log_cache.insert(0, alert)
    if len(log_cache) > 20:
        log_cache.pop()
        
    from backend import database
    for d in dispatches:
        try:
            database.log_dispatch("OHT Load Alert", d["payload"], d["recipient"], d["channel"])
        except Exception:
            pass
    return alert

