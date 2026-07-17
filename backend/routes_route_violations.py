from fastapi import APIRouter, HTTPException
from datetime import datetime
from backend import database
from backend.reports_compliance_logic import parse_ts

router = APIRouter(prefix="/admin")

# Route segment minimum transit times (in seconds)
SEGMENT_LIMITS = {
    ("North Checkpoint", "Main Portal"): 300.0,
    ("Main Portal", "North Checkpoint"): 300.0,
    ("South Gate", "Main Portal"): 240.0,
    ("Main Portal", "South Gate"): 240.0,
    ("North Checkpoint", "South Gate"): 420.0,
    ("South Gate", "North Checkpoint"): 420.0,
}

@router.get("/reports/route-violations")
def get_route_violations():
    try:
        crossings = database.get_all_crossings()
        
        # Group non-duplicate crossings by hull_id
        truck_history = {}
        for c in crossings:
            if c.get("is_duplicate"):
                continue
            hid = c.get("hull_id")
            if hid:
                truck_history.setdefault(hid, []).append(c)
                
        violations = []
        
        # Read audit logs to prevent duplicate logging
        try:
            existing_audits = database.get_all_audits()
        except Exception:
            existing_audits = []
            
        def is_already_logged(details_sub):
            for aud in existing_audits:
                if aud.get("action") == "route_violation" and details_sub in aud.get("details", ""):
                    return True
            return False

        for hid, hist in truck_history.items():
            # Sort chronologically
            hist.sort(key=lambda x: parse_ts(x["timestamp"]))
            
            for i in range(1, len(hist)):
                c1 = hist[i - 1]
                c2 = hist[i]
                
                lane1 = c1.get("lane")
                lane2 = c2.get("lane")
                
                # We only check violations across different checkpoints
                if lane1 == lane2:
                    continue
                    
                limit = SEGMENT_LIMITS.get((lane1, lane2))
                if not limit:
                    continue
                    
                t1 = parse_ts(c1["timestamp"])
                t2 = parse_ts(c2["timestamp"])
                elapsed = (t2 - t1).total_seconds()
                
                # Check for shortcut infraction: transit time is physically too short
                if elapsed < limit:
                    time_str = t2.strftime("%Y-%m-%d %H:%M:%S")
                    details = f"Vehicle {hid} transit from {lane1} to {lane2} took only {elapsed:.0f}s (Min threshold: {limit:.0f}s)."
                    audit_details = f"[{time_str}] {details}"
                    
                    if not is_already_logged(audit_details):
                        try:
                            database.log_audit("route_violation", audit_details, "system")
                        except Exception:
                            pass
                            
                    violations.append({
                        "hull_id": hid,
                        "segment": f"{lane1} ➔ {lane2}",
                        "timestamp": t2.isoformat(),
                        "elapsed_seconds": elapsed,
                        "min_seconds": limit,
                        "details": details
                    })
                    
        return {
            "status": "success",
            "violations": violations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
