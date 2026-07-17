from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import io
import csv
from backend import routes_telemetry

router = APIRouter()

@router.get("/telemetry/export-csv")
@router.get("/reports/telemetry-csv")
def export_telemetry_csv():
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Tower ID", "Battery Level (%)", "Solar Output (W)", "Charging Current (A)", "Latency (ms)"])
    
    logs = routes_telemetry._telemetry_history_logs
    for entry in logs:
        writer.writerow([
            entry.get("timestamp", ""),
            entry.get("tower_id", ""),
            entry.get("battery", 0),
            entry.get("solar_output", 0),
            entry.get("charging_current", 0.0),
            entry.get("latency", 0)
        ])
        
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=telemetry_history.csv"}
    )
