import time
import random
from datetime import datetime
from typing import Dict, Any, Optional

def trigger_backup_integrity_alert(backup_file: str, error_details: str) -> Optional[Dict[str, Any]]:
    from backend import database
    alert_id = f"ALT-INT-{int(time.time())}-{random.randint(100, 999)}"
    alert = {
        "alert_id": alert_id,
        "type": "dispatch_alert",
        "trigger_source": "database_integrity",
        "timestamp": datetime.utcnow().isoformat(),
        "severity": "critical",
        "message": f"Database Backup Integrity Failure: {backup_file} - {error_details}",
        "dispatches": [
            {
                "channel": "SMS",
                "recipient": "+62 811-555-0100 (Database Administrator)",
                "status": "SENT",
                "payload": f"CRITICAL DATABASE ALERT: Integrity check failed on backup {backup_file}. Error: {error_details}."
            },
            {
                "channel": "Email",
                "recipient": "db-alerts@tunasinti.co.id",
                "status": "SENT",
                "payload": f"Subject: [SmartGate Database Alert] Backup Integrity Check Failed\n\nBody: The database backup file {backup_file} was verified after creation but failed SQLite integrity check.\nError Details: {error_details}\nImmediate manual verification and database recovery check is required."
            }
        ]
    }
    
    from backend import alerts_dispatcher
    log_cache = alerts_dispatcher.get_dispatches_log()
    log_cache.insert(0, alert)
    if len(log_cache) > 20:
        log_cache.pop()
    for d in alert["dispatches"]:
        try: database.log_dispatch("Database Integrity Alert", d["payload"], d["recipient"], d["channel"])
        except Exception: pass
    return alert
