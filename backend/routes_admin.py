from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
import os
from backend import database
from backend.database_stats import upsert_daily_stat, delete_crossing

router = APIRouter()

def parse_ts(ts):
    if ts.endswith("Z"): ts = ts[:-1]
    if "." in ts:
        parts = ts.split(".")
        parts[1] = parts[1][:6]
        ts = ".".join(parts)
    ts = ts.replace(" ", "T")
    return datetime.fromisoformat(ts)

@router.post("/admin/prune-crossings")
def prune_crossings(days: int = 7):
    try:
        crossings = database.get_all_crossings()
        now = datetime.utcnow()
        
        crossings_to_prune = []
        for c in crossings:
            try:
                c_time = parse_ts(c["timestamp"])
                if (now - c_time).days >= days:
                    crossings_to_prune.append(c)
            except Exception as ex:
                pass
                
        if not crossings_to_prune:
            return {
                "status": "success",
                "pruned_crossings_count": 0,
                "deleted_images_count": 0,
                "message": "No crossings older than specified days found."
            }
            
        trucks = database.get_all_trucks()
        truck_registry = {t["hull_id"]: t["contractor"] for t in trucks}
        
        # Aggregate stats before pruning
        daily_stats_map = {}
        for c in crossings_to_prune:
            if c.get("is_duplicate"):
                continue
            date_str = c["timestamp"][:10]
            contractor = truck_registry.get(c["hull_id"], "Ad-hoc Contractor")
            key = (date_str, contractor)
            if key not in daily_stats_map:
                daily_stats_map[key] = { "crossings": 0, "crossings_list": [] }
            daily_stats_map[key]["crossings"] += 1
            daily_stats_map[key]["crossings_list"].append(c)
            
        for (date_str, contractor), val in daily_stats_map.items():
            c_list = val["crossings_list"]
            truck_c = {}
            for c in c_list:
                truck_c.setdefault(c["hull_id"], []).append(c)
                
            total_trips = 0
            for hid, t_list in truck_c.items():
                t_list.sort(key=lambda x: x["timestamp"])
                trips = 0
                last_dir = None
                for c in t_list:
                    direction = c["direction"].lower()
                    if last_dir == "inbound" and direction == "outbound":
                        trips += 1
                        last_dir = None
                    else:
                        last_dir = direction
                total_trips += trips
                
            active_hours = 1.0
            if c_list:
                try:
                    timestamps = [parse_ts(c["timestamp"]) for c in c_list]
                    diff = (max(timestamps) - min(timestamps)).total_seconds() / 3600.0
                    if diff > 0.1: active_hours = diff
                except:
                    pass
            
            upsert_daily_stat(date_str, contractor, val["crossings"], total_trips, active_hours)
            
        deleted_images_count = 0
        for c in crossings_to_prune:
            for path_key in ["crop_image_path", "context_image_path"]:
                img_path = c.get(path_key)
                if img_path and os.path.exists(img_path):
                    try:
                        os.remove(img_path)
                        deleted_images_count += 1
                    except:
                        pass
            delete_crossing(c["id"])
            
        return {
            "status": "success",
            "pruned_crossings_count": len(crossings_to_prune),
            "deleted_images_count": deleted_images_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system/status")
def get_system_status():
    try:
        try:
            conn = database.get_db_connection()
            conn.execute("SELECT 1").fetchone()
            conn.close()
            sqlite_status = "connected"
        except Exception:
            sqlite_status = "disconnected"
            
        from backend.routes_telemetry import get_current_towers_telemetry
        towers = []
        try:
            towers = get_current_towers_telemetry()
            towers_status = "normal"
            if any(t["status"] == "warning" for t in towers):
                towers_status = "degraded"
        except Exception:
            towers_status = "unknown"
            
        evidence_dir = "data/evidence"
        total_size_bytes = 0
        if os.path.exists(evidence_dir):
            for dirpath, dirnames, filenames in os.walk(evidence_dir):
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    if os.path.exists(fp):
                        total_size_bytes += os.path.getsize(fp)
                        
        def format_size(size):
            for unit in ['B', 'KB', 'MB', 'GB']:
                if size < 1024.0:
                    return f"{size:.2f} {unit}"
                size /= 1024.0
            return f"{size:.2f} TB"
        formatted_size = format_size(total_size_bytes)
        
        warning_pct = 0.0
        if sqlite_status == "disconnected":
            warning_pct = 100.0
        else:
            warn_towers_count = sum(1 for t in towers if t["status"] == "warning")
            warning_pct += warn_towers_count * 20.0
            if total_size_bytes > 100 * 1024 * 1024:
                warning_pct += 15.0
                
        warning_pct = min(100.0, warning_pct)
        status_label = "healthy"
        if warning_pct >= 50.0:
            status_label = "unhealthy"
        elif warning_pct > 0.0:
            status_label = "warning"
            
        return {
            "status": status_label,
            "warning_percentage": warning_pct,
            "details": {
                "sqlite_connectivity": sqlite_status,
                "towers_status": towers_status,
                "towers": [{"id": t["id"], "status": t["status"], "latency": t["latency"]} for t in towers],
                "evidence_disk_usage_bytes": total_size_bytes,
                "evidence_disk_usage_formatted": formatted_size
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel
class ContractorTargetsOverrideReq(BaseModel):
    contractor: str
    target_rate: float

@router.put("/admin/contractor-targets")
async def override_contractor_targets(req: ContractorTargetsOverrideReq):
    try:
        database.set_contractor_target(req.contractor, req.target_rate)
        from backend.websocket_manager import manager
        targets = database.get_contractor_targets()
        await manager.broadcast({
            "type": "targets_updated",
            "targets": targets
        })
        return {
            "status": "success",
            "targets": targets,
            "message": f"Successfully updated contractor target for {req.contractor} to {req.target_rate} ritase/hr."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/backup-db")
def backup_database():
    from fastapi.responses import JSONResponse
    try:
        clean = lambda rows: [{k: (v.decode("utf-8") if isinstance(v, bytes) else v) for k, v in dict(r).items()} for r in rows]
        data = {
            "backup_timestamp": datetime.utcnow().isoformat(),
            "trucks": clean(database.get_all_trucks()),
            "crossings": clean(database.get_all_crossings())
        }
        return JSONResponse(content=data, headers={"Content-Disposition": "attachment; filename=smart_gate_db_backup.json"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/restore-db")
def restore_database(payload: dict):
    try:
        trucks = payload.get("trucks", [])
        crossings = payload.get("crossings", [])
        database.clear_and_restore_db(trucks, crossings)
        return {"status": "success", "restored_trucks": len(trucks), "restored_crossings": len(crossings)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



