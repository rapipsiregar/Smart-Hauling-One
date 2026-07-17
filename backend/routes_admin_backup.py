import os
import gzip
import shutil
import sqlite3
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from backend import backup_service, database

router = APIRouter(prefix="/admin")

@router.post("/db-backup")
def post_db_backup():
    try:
        backup_file_path = backup_service.perform_backup()
        file_size_bytes = os.path.getsize(backup_file_path)
        return {
            "status": "success",
            "filename": os.path.basename(backup_file_path),
            "size_bytes": file_size_bytes,
            "path": backup_file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/db-backups")
def get_db_backups():
    try:
        db_dir = os.path.dirname(database.DB_PATH) or "data"
        backups = []
        for f in os.listdir(db_dir):
            if f.startswith("backup_") and f.endswith(".db.gz"):
                f_path = os.path.join(db_dir, f)
                stat = os.stat(f_path)
                backups.append({
                    "filename": f,
                    "size_bytes": stat.st_size,
                    "created_at": stat.st_mtime
                })
        backups.sort(key=lambda x: x["created_at"], reverse=True)
        return {"status": "success", "backups": backups}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/db-backups/{filename}")
def download_db_backup(filename: str):
    db_dir = os.path.dirname(database.DB_PATH) or "data"
    f_path = os.path.join(db_dir, filename)
    if not os.path.exists(f_path) or not filename.startswith("backup_") or not filename.endswith(".db.gz"):
        raise HTTPException(status_code=404, detail="Backup file not found")
    return FileResponse(path=f_path, filename=filename, media_type="application/gzip")

@router.post("/db-backups/{filename}/restore")
def restore_db_backup(filename: str):
    db_dir = os.path.dirname(database.DB_PATH) or "data"
    f_path = os.path.join(db_dir, filename)
    if not os.path.exists(f_path) or not filename.startswith("backup_") or not filename.endswith(".db.gz"):
        raise HTTPException(status_code=404, detail="Backup file not found")
        
    temp_restored_path = f"{f_path}.restore_temp"
    try:
        with gzip.open(f_path, 'rb') as f_in:
            with open(temp_restored_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
                
        conn = sqlite3.connect(temp_restored_path)
        try:
            res = conn.execute("PRAGMA integrity_check").fetchone()
            if not res or res[0] != "ok":
                raise ValueError(f"Backup file integrity check failed: {res[0] if res else 'No response'}")
        finally:
            conn.close()
            
        src_conn = sqlite3.connect(temp_restored_path)
        dest_conn = sqlite3.connect(database.DB_PATH)
        try:
            src_conn.backup(dest_conn)
        finally:
            dest_conn.close()
            src_conn.close()
            
        try:
            database.log_audit(
                action="db_backup_restore",
                details=f"Database successfully restored from backup file: {filename}"
            )
        except Exception:
            pass
            
        return {"status": "success", "message": f"Database successfully restored from {filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore database: {str(e)}")
    finally:
        if os.path.exists(temp_restored_path):
            os.remove(temp_restored_path)
