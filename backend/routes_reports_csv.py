from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime, timedelta
import io
import csv
import time
from backend import database

router = APIRouter()

@router.get("/reports/export-csv")
def export_csv(query: str = None, lane: str = None, direction: str = None):
    try:
        crossings = database.get_all_crossings()
        flt = []
        for c in crossings:
            if (not lane or lane.strip().lower() in c["lane"].strip().lower()) and \
               (not direction or direction.strip().lower() == c["direction"].strip().lower()) and \
               (not query or query.strip().lower() in c["hull_id"].strip().lower()):
                flt.append(c)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Log ID", "Timestamp", "OHT Hull ID", "Lane", "Direction", "Confidence %", "Crop Image Path", "Context Image Path"])
        for c in flt:
            writer.writerow([c["id"], c["timestamp"], c["hull_id"], c["lane"], c["direction"], c["confidence"], c["crop_image_path"], c["context_image_path"]])
        output.seek(0)
        return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=gate_crossings_reconciliation.csv"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reports/sync")
def sync_data():
    try:
        time.sleep(0.4)
        return {
            "status": "success",
            "sync_time": datetime.utcnow().isoformat(),
            "synchronized_records_count": len(database.get_all_crossings())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports/utilization")
def get_fleet_utilization():
    try:
        trucks = database.get_all_trucks()
        crossings = database.get_all_crossings()
        active_trucks = [t for t in trucks if t["status"] == "active"]
        total_active = len(active_trucks)
        now = datetime.utcnow()
        day_ago = now - timedelta(days=1)
        def parse_ts(ts):
            if ts.endswith("Z"): ts = ts[:-1]
            if "." in ts:
                parts = ts.split(".")
                parts[1] = parts[1][:6]
                ts = ".".join(parts)
            return datetime.fromisoformat(ts)
        recent_crossings = []
        for c in crossings:
            try:
                dt = parse_ts(c["timestamp"])
                if dt >= day_ago:
                    recent_crossings.append(c)
            except:
                pass
        active_hids = {t["hull_id"] for t in active_trucks}
        logged_active_hids = {c["hull_id"] for c in recent_crossings if c["hull_id"] in active_hids}
        rate = 0.0
        if total_active > 0:
            rate = round((len(logged_active_hids) / total_active) * 100, 1)
        return {
            "total_active_registered": total_active,
            "unique_active_logged": len(logged_active_hids),
            "utilization_rate": rate,
            "logged_trucks": list(logged_active_hids)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
