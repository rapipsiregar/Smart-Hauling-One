from datetime import datetime, timedelta
from typing import Dict, Any, List
from backend import database

def parse_ts(ts):
    if ts.endswith("Z"): ts = ts[:-1]
    if "." in ts:
        parts = ts.split(".")
        parts[1] = parts[1][:6]
        ts = ".".join(parts)
    return datetime.fromisoformat(ts)

def calculate_contractor_compliance(
    trucks: List[Dict[str, Any]],
    contractor_cycles: Dict[str, int],
    active_hours: float,
    recent_hids: set
) -> Dict[str, Any]:
    contractor_thresholds = database.get_contractor_targets()
    contractor_min_fleet = database.get_contractor_min_fleet()
    
    compliance = {}
    for contractor, target in contractor_thresholds.items():
        cycles = contractor_cycles.get(contractor, 0)
        hourly_rate = round(cycles / active_hours, 2)
        pct = round(min((hourly_rate / target) * 100, 100.0), 1) if target > 0 else 100.0
        
        active_fleet = [t for t in trucks if t["contractor"] == contractor and t["status"] == "active"]
        min_fleet = contractor_min_fleet.get(contractor, 5)
        logged_trucks = sum(1 for t in active_fleet if t["hull_id"] in recent_hids)
        utilization = round(min((logged_trucks / max(min_fleet, 1)) * 100.0, 100.0), 1)
        
        compliance[contractor] = {
            "completed_cycles": cycles, 
            "hourly_capacity": hourly_rate, 
            "target_threshold": target, 
            "compliance_pct": pct,
            "min_active_fleet": min_fleet,
            "logged_active_trucks": logged_trucks,
            "utilization_pct": utilization
        }
    return compliance

def calculate_hourly_compliance(
    truck_crossings: Dict[str, List[Dict[str, Any]]],
    trucks: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    contractor_thresholds = database.get_contractor_targets()
    now = datetime.utcnow()
    hourly_compliance = []
    
    for i in range(11, -1, -1):
        h_start = now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=i)
        h_end = h_start + timedelta(hours=1)
        hour_str = h_start.strftime("%H:00")
        
        hourly_cycles = {}
        for hid, c_list in truck_crossings.items():
            truck = next((t for t in trucks if t["hull_id"] == hid), None)
            contractor = truck["contractor"] if truck else "Ad-hoc Contractor"
            
            c_list_sorted = sorted(c_list, key=lambda x: x["timestamp"])
            last_dir = None
            for c in c_list_sorted:
                try:
                    c_dt = parse_ts(c["timestamp"])
                except:
                    continue
                direction = c["direction"].lower()
                
                if last_dir == "inbound" and direction == "outbound":
                    if h_start <= c_dt < h_end:
                        hourly_cycles[contractor] = hourly_cycles.get(contractor, 0) + 1
                    last_dir = None
                else:
                    last_dir = direction
                    
        rates = {}
        for contractor, target in contractor_thresholds.items():
            cycles = hourly_cycles.get(contractor, 0)
            rate = round(min((cycles / target) * 100, 100.0), 1) if target > 0 else 100.0
            rates[contractor] = rate
            
        hourly_compliance.append({
            "hour": hour_str,
            "rates": rates
        })
    return hourly_compliance
