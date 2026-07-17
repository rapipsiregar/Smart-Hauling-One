from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from backend import database
from backend.websocket_manager import manager
from backend.reports_compliance_logic import parse_ts
import asyncio

router = APIRouter(prefix="/reports")

def get_current_shift_range(dt: datetime) -> tuple[datetime, datetime, str]:
    if 6 <= dt.hour < 18:
        start = dt.replace(hour=6, minute=0, second=0, microsecond=0)
        end = dt.replace(hour=18, minute=0, second=0, microsecond=0)
        name = "Day"
    elif dt.hour >= 18:
        start = dt.replace(hour=18, minute=0, second=0, microsecond=0)
        end = (dt + timedelta(days=1)).replace(hour=6, minute=0, second=0, microsecond=0)
        name = "Night"
    else:
        start = (dt - timedelta(days=1)).replace(hour=18, minute=0, second=0, microsecond=0)
        end = dt.replace(hour=6, minute=0, second=0, microsecond=0)
        name = "Night"
    return start, end, name

@router.post("/oht-overload-check")
async def check_oht_overload():
    try:
        now = datetime.utcnow()
        start, end, shift_name = get_current_shift_range(now)
        
        crossings = database.get_all_crossings()
        trucks = database.get_all_trucks()
        
        shift_crossings = []
        for c in crossings:
            if c.get("is_duplicate"):
                continue
            try:
                c_ts = parse_ts(c["timestamp"])
                if start <= c_ts < end:
                    shift_crossings.append(c)
            except Exception:
                continue
                
        truck_crossings = {}
        for c in shift_crossings:
            hid = c["hull_id"]
            if hid not in truck_crossings:
                truck_crossings[hid] = []
            truck_crossings[hid].append(c)
            
        checked_vehicles = []
        triggered_alerts = []
        
        from backend.alerts_dispatcher import trigger_oht_overload_alert
        
        for hid, c_list in truck_crossings.items():
            c_list.sort(key=lambda x: parse_ts(x["timestamp"]))
            
            trips = 0
            last_dir = None
            for c in c_list:
                direction = c["direction"].lower()
                if last_dir == "inbound" and direction == "outbound":
                    trips += 1
                    last_dir = None
                else:
                    last_dir = direction
                    
            truck = next((t for t in trucks if t["hull_id"] == hid), None)
            contractor = truck["contractor"] if truck else "PT Tunas Inti Abadi"
            
            status = "normal"
            alert = None
            if trips > 20:
                status = "exceeded"
                alert = trigger_oht_overload_alert(
                    hull_id=hid,
                    contractor=contractor,
                    ritase=trips,
                    shift_name=f"{start.strftime('%Y-%m-%d')} {shift_name}"
                )
                if alert:
                    triggered_alerts.append(alert)
                    try:
                        await manager.broadcast(alert)
                    except Exception:
                        pass
                        
            checked_vehicles.append({
                "hull_id": hid,
                "contractor": contractor,
                "completed_ritase": trips,
                "status": status
            })
            
        return {
            "status": "success",
            "checked_vehicles": checked_vehicles,
            "triggered_alerts": triggered_alerts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
