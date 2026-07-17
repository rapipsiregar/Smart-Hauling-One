from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from backend.reports_logic import calculate_shift_summary
from backend.reports_class_logic import calculate_class_distribution
from backend.reports_excel_exporter import generate_reconciliation_excel

router = APIRouter()

@router.get("/reports/shift-summary")
def get_shift_summary():
    try:
        return calculate_shift_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports/class-distribution")
def get_class_distribution():
    try:
        return calculate_class_distribution()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports/reconciliation-export")
def get_reconciliation_export():
    try:
        excel_data = generate_reconciliation_excel()
        return StreamingResponse(
            excel_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=hauling_reconciliation_report.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel

class ResolveDiscrepancyReq(BaseModel):
    discrepancy_id: str
    operator_notes: str

@router.post("/reports/resolve-discrepancy")
def resolve_discrepancy(req: ResolveDiscrepancyReq):
    try:
        from backend import database
        database.insert_discrepancy_resolution(
            discrepancy_id=req.discrepancy_id,
            operator_notes=req.operator_notes,
            resolved_by="operator"
        )
        return {"status": "success", "message": "Discrepancy resolved successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
