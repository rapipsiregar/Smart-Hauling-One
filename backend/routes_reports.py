from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from backend.reports_logic import calculate_shift_summary, calculate_class_distribution
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
