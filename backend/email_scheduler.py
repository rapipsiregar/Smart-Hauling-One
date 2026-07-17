import time
import threading
from datetime import datetime
from backend import database
from backend.reports_logic import calculate_shift_summary
from backend.routes_contractor_efficiency import get_contractor_efficiency_grid
from backend.websocket_manager import manager

_last_run = 0

def generate_compliance_email_html(compliance: dict, efficiency_grid: list, blocks: list) -> str:
    from backend.routes_admin_email_schedule import generate_compliance_email_html as gen_html
    return gen_html(compliance, efficiency_grid, blocks)

def run_email_distribution():
    try:
        summary = calculate_shift_summary()
        compliance = summary.get("compliance", {})
        
        eff_grid_response = get_contractor_efficiency_grid()
        efficiency_grid = eff_grid_response.get("grid", [])
        blocks = eff_grid_response.get("blocks", [])
        
        email_html = generate_compliance_email_html(compliance, efficiency_grid, blocks)
        recipient = database.get_system_setting("email_schedule_recipient", "supervisor-shift-end@tunasinti.co.id")
        
        # Log to dispatches database
        database.log_dispatch(
            alert_type="Compliance Shift Summary Email",
            message=email_html,
            recipient=recipient,
            channel="Email"
        )
        
        # Broadcast to WebSocket
        alert = {
            "alert_id": f"ALT-CS-{int(datetime.utcnow().timestamp())}",
            "type": "dispatch_alert",
            "trigger_source": "compliance_email",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "severity": "info",
            "message": f"Automated compliance report shift summary email sent to {recipient}."
        }
        
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(manager.broadcast(alert))
        except Exception:
            pass
            
    except Exception:
        pass

def email_scheduler_loop():
    global _last_run
    # Sleep on start to allow startup to complete
    time.sleep(10)
    while True:
        try:
            enabled = database.get_system_setting("email_schedule_enabled", "true") == "true"
            if enabled:
                interval_mins = int(database.get_system_setting("email_schedule_interval", "60"))
                now = time.time()
                if _last_run == 0:
                    _last_run = now
                elif now - _last_run >= interval_mins * 60:
                    run_email_distribution()
                    _last_run = now
        except Exception:
            pass
        time.sleep(10)

def start_email_scheduler():
    t = threading.Thread(target=email_scheduler_loop, daemon=True)
    t.start()
