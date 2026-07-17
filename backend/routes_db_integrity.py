from fastapi import APIRouter, HTTPException
from backend import db_integrity_checker

router = APIRouter(prefix="/admin/db")

@router.get("/integrity-check")
def manual_integrity_check():
    success = db_integrity_checker.perform_integrity_check()
    if success:
        return {"status": "success", "message": "Database structural integrity check succeeded."}
    else:
        raise HTTPException(status_code=500, detail="Database integrity check failed or encountered an error. Please inspect system audit logs.")
