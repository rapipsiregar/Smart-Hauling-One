from fastapi import APIRouter, HTTPException
from backend import database

router = APIRouter()

@router.get("/alerts/dispatches")
def get_dispatch_logs():
    try:
        return database.get_all_dispatches()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
