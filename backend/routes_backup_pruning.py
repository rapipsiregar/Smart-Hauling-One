from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.backup_pruner import run_backup_pruning

router = APIRouter(prefix="/admin")

class PruneRequest(BaseModel):
    days_threshold: Optional[int] = 7
    min_free_mb: Optional[float] = 50.0

@router.post("/backups/prune")
def prune_backups(req: PruneRequest):
    try:
        pruned_files, free_mb = run_backup_pruning(
            days_threshold=req.days_threshold,
            min_free_mb=req.min_free_mb
        )
        return {
            "status": "success",
            "pruned_files": pruned_files,
            "free_disk_space_mb": round(free_mb, 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
