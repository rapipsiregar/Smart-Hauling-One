from typing import List, Dict, Any

_dispatches_log: List[Dict[str, Any]] = []

def get_dispatches_log() -> List[Dict[str, Any]]:
    return _dispatches_log

# Import and expose sub-modules triggers
from backend.alerts_crossing import trigger_crossing_alert
from backend.alerts_telemetry import (
    trigger_telemetry_alert,
    trigger_latency_alert,
    trigger_offline_alert,
    trigger_watchdog_degradation_alert,
    trigger_battery_drain_alert,
)
from backend.alerts_compliance import (
    trigger_compliance_warning_alert,
    trigger_contractor_compliance_alert,
    trigger_oht_overload_alert,
)
from backend.alerts_integrity import trigger_backup_integrity_alert

