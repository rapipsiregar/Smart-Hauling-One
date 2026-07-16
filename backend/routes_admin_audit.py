from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from datetime import datetime
from backend import database

router = APIRouter()

@router.get("/admin/audit-logs")
def get_audit_logs():
    try:
        return database.get_all_audits()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/audit-logs/export")
def export_audit_logs(action: str = None, operator: str = None, start_date: str = None, end_date: str = None):
    try:
        logs = database.get_all_audits()
        
        if action:
            logs = [l for l in logs if l["action"].lower() == action.lower()]
            
        if operator:
            logs = [l for l in logs if l["operator"].lower() == operator.lower()]
            
        if start_date:
            logs = [l for l in logs if l["timestamp"] >= start_date]
        if end_date:
            logs = [l for l in logs if l["timestamp"] <= end_date]
            
        # Sort chronologically (oldest to newest)
        logs.sort(key=lambda x: x["timestamp"])
        
        return JSONResponse(
            content={
                "exported_at": datetime.utcnow().isoformat(),
                "logs_count": len(logs),
                "audit_logs": logs
            },
            headers={"Content-Disposition": "attachment; filename=smart_gate_audit_export.json"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
