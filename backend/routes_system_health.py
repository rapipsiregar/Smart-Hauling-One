import os
import psutil
from fastapi import APIRouter, HTTPException
from backend import database

router = APIRouter()

def format_size(size: float) -> str:
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            return f"{size:.2f} {unit}"
        size /= 1024.0
    return f"{size:.2f} TB"

@router.get("/system/health")
def get_system_health():
    try:
        # Get CPU utilization (percent)
        cpu_util = psutil.cpu_percent(interval=0.1)
        
        # Get RAM utilization
        ram = psutil.virtual_memory()
        ram_util = ram.percent
        
        # Get Disk utilization for the directory where DB is stored
        db_dir = os.path.dirname(os.path.abspath(database.DB_PATH))
        # Ensure db_dir exists, if not fallback to current directory
        if not os.path.exists(db_dir):
            db_dir = os.getcwd()
            
        disk = psutil.disk_usage(db_dir)
        disk_util = disk.percent
        
        # Get DB file size
        db_size = 0
        if os.path.exists(database.DB_PATH):
            db_size = os.path.getsize(database.DB_PATH)
            
        return {
            "status": "success",
            "cpu_utilization_pct": cpu_util,
            "ram_utilization_pct": ram_util,
            "disk_utilization_pct": disk_util,
            "db_file_size_bytes": db_size,
            "db_file_size_formatted": format_size(db_size)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
