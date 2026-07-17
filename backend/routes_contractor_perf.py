from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from typing import Optional
from backend import database

router = APIRouter()

@router.get("/reports/contractor-performance")
def get_contractor_performance():
    try:
        crossings = [c for c in database.get_all_crossings() if not c.get("is_duplicate")]
        trucks = database.get_all_trucks()
        
        truck_crossings = {}
        for c in crossings:
            truck_crossings.setdefault(c["hull_id"], []).append(c)
            
        completed_ritase = {}
        for hid, c_list in truck_crossings.items():
            c_list.sort(key=lambda x: x["timestamp"])
            trips = 0
            last_dir = None
            for c in c_list:
                direction = c["direction"].lower()
                if last_dir == "inbound" and direction == "outbound":
                    trips += 1
                    last_dir = None
                else:
                    last_dir = direction
            completed_ritase[hid] = trips

        active_hours = 1.0
        if crossings:
            try:
                def parse_ts(ts):
                    if ts.endswith("Z"): ts = ts[:-1]
                    if "." in ts:
                        parts = ts.split(".")
                        parts[1] = parts[1][:6]
                        ts = ".".join(parts)
                    return datetime.fromisoformat(ts)
                timestamps = [parse_ts(c["timestamp"]) for c in crossings]
                diff = (max(timestamps) - min(timestamps)).total_seconds() / 3600.0
                if diff > 0.1: active_hours = diff
            except: pass

        contractor_cycles = {}
        for hid, cycles in completed_ritase.items():
            truck = next((t for t in trucks if t["hull_id"] == hid), None)
            contractor = truck["contractor"] if truck else "Ad-hoc Contractor"
            contractor_cycles[contractor] = contractor_cycles.get(contractor, 0) + cycles

        from backend.database_stats import get_all_daily_stats
        try:
            day_hours = {}
            for row in get_all_daily_stats():
                c = row["contractor"]
                contractor_cycles[c] = contractor_cycles.get(c, 0) + row["cycles"]
                day_hours[row["date"]] = max(day_hours.get(row["date"], 0.0), row.get("active_hours", 24.0))
            active_hours += sum(day_hours.values())
        except:
            pass

        contractor_thresholds = database.get_contractor_targets()
        contractor_min_fleet = database.get_contractor_min_fleet()

        # Parse timestamps to find crossings in last 24 hours
        now = datetime.utcnow()
        day_ago = now - timedelta(days=1)
        recent_crossings = []
        for c in crossings:
            try:
                def parse_ts(ts):
                    if ts.endswith("Z"): ts = ts[:-1]
                    if "." in ts:
                        parts = ts.split(".")
                        parts[1] = parts[1][:6]
                        ts = ".".join(parts)
                    return datetime.fromisoformat(ts)
                dt = parse_ts(c["timestamp"])
                if dt >= day_ago:
                    recent_crossings.append(c)
            except:
                pass
        recent_hids = {c["hull_id"] for c in recent_crossings}

        perf = {}
        # Get list of unique contractors in fleet registry
        all_contractors = set(t["contractor"] for t in trucks if t.get("contractor"))
        all_contractors.add("Ad-hoc Contractor")
        
        for contractor in all_contractors:
            total_cycles = contractor_cycles.get(contractor, 0)
            active_fleet = [t for t in trucks if t["contractor"] == contractor and t["status"] == "active"]
            fleet_size = len(active_fleet)
            
            avg_cycles = round(total_cycles / fleet_size, 2) if fleet_size > 0 else 0.0
            hourly_rate = round(total_cycles / active_hours, 2)
            target = contractor_thresholds.get(contractor, 1.0)
            compliance = round(min((hourly_rate / target) * 100, 100.0), 1)
            
            # Subcontractor utilization score
            min_fleet = contractor_min_fleet.get(contractor, 5)
            logged_trucks = sum(1 for t in active_fleet if t["hull_id"] in recent_hids)
            utilization = round(min((logged_trucks / max(min_fleet, 1)) * 100.0, 100.0), 1)
            
            perf[contractor] = {
                "total_cycles": total_cycles,
                "active_fleet_size": fleet_size,
                "avg_cycles_per_truck": avg_cycles,
                "hourly_capacity": hourly_rate,
                "target_threshold": target,
                "compliance_pct": compliance,
                "min_active_fleet": min_fleet,
                "logged_active_trucks": logged_trucks,
                "utilization_pct": utilization
            }
            
        return {"contractors": perf}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel
class UpdateTargetReq(BaseModel):
    contractor: str
    target_rate: float
    min_active_fleet: int = 5

@router.post("/reports/contractor-performance/targets")
def post_contractor_target(req: UpdateTargetReq):
    try:
        database.set_contractor_target(req.contractor, req.target_rate, req.min_active_fleet)
        return {
            "status": "success", 
            "targets": database.get_contractor_targets(),
            "min_fleet": database.get_contractor_min_fleet()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SendWarningReq(BaseModel):
    recipient_email: str
    contractor: str
    custom_message: Optional[str] = None

@router.post("/reports/contractor-performance/send-warning")
def send_contractor_warning(req: SendWarningReq):
    try:
        perf_data = get_contractor_performance()
        contractors = perf_data.get("contractors", {})
        if req.contractor not in contractors:
            raise HTTPException(status_code=404, detail="Contractor performance data not found")
            
        c_perf = contractors[req.contractor]
        
        custom_note = f"Supervisor's Remarks:\n\"{req.custom_message}\"\n\n" if req.custom_message else ""
        
        warning_msg = (
            f"Subject: [SmartGate Compliance Warning] Low Ritase Capacity - {req.contractor}\n\n"
            f"Dear Team,\n\n"
            f"{custom_note}"
            f"This is an automated compliance warning regarding subcontractor '{req.contractor}'.\n\n"
            f"Current active hourly capacity: {c_perf['hourly_capacity']} ritase/hr\n"
            f"Target expected capacity: {c_perf['target_threshold']} ritase/hr\n"
            f"Current Target Compliance Rate: {c_perf['compliance_pct']}%\n"
            f"Active Registered Fleet Size: {c_perf['active_fleet_size']} OHT vehicles\n"
            f"Average completed cycles per OHT: {c_perf['avg_cycles_per_truck']} cycles\n\n"
            f"Please verify subcontractor performance and optimize skid hauling efficiency.\n\n"
            f"Best regards,\nSmartGate Automated Compliance Manager"
        )
        
        from backend import alerts_dispatcher
        from backend.websocket_manager import manager
        import asyncio
        
        alert = alerts_dispatcher.trigger_compliance_warning_alert(
            contractor=req.contractor,
            recipient_email=req.recipient_email,
            payload=warning_msg
        )
        
        if alert:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(manager.broadcast(alert))
            except Exception:
                pass
                
        database.log_audit(
            action="warning_dispatch",
            details=f"Compliance warning alert dispatched to {req.recipient_email} for contractor {req.contractor}."
        )
        return {
            "status": "success",
            "message": f"Compliance warning alert email logged and dispatched to {req.recipient_email}",
            "warning_message": warning_msg
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reports/contractor-performance/compliance-check")
def check_contractor_compliance():
    try:
        perf_data = get_contractor_performance()
        contractors = perf_data.get("contractors", {})
        
        triggered_alerts = []
        
        from backend import alerts_dispatcher
        from backend.websocket_manager import manager
        import asyncio
        
        for contractor, stats in contractors.items():
            compliance_pct = stats.get("compliance_pct", 100.0)
            if compliance_pct < 80.0:
                alert = alerts_dispatcher.trigger_contractor_compliance_alert(
                    contractor=contractor,
                    compliance_pct=compliance_pct,
                    hourly_rate=stats.get("hourly_capacity", 0.0),
                    target=stats.get("target_threshold", 1.0)
                )
                if alert:
                    triggered_alerts.append(alert)
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(manager.broadcast(alert))
                    except Exception:
                        pass
                        
                    database.log_audit(
                        action="compliance_alert_dispatch",
                        details=f"Critical compliance drop alert dispatched for contractor {contractor} (Current: {compliance_pct}%)."
                    )
                    
        return {
            "status": "success",
            "checked_count": len(contractors),
            "triggered_count": len(triggered_alerts),
            "triggered_alerts": triggered_alerts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

