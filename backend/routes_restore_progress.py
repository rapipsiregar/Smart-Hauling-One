import threading
import time
import os
import gzip
import sqlite3
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from backend import database

router = APIRouter(prefix="/admin")

restore_state = {
    "status": "idle",
    "progress": 0,
    "error": None
}

def run_restore_task(filename: str):
    global restore_state
    restore_state["status"] = "starting"
    restore_state["progress"] = 0
    restore_state["error"] = None

    db_dir = os.path.dirname(database.DB_PATH) or "data"
    f_path = os.path.join(db_dir, filename)

    if not os.path.exists(f_path) or not filename.startswith("backup_") or not filename.endswith(".db.gz"):
        restore_state["status"] = "failed"
        restore_state["error"] = "Backup file not found"
        return

    temp_restored_path = f"{f_path}.restore_temp"
    try:
        # Phase 1: Decompressing
        restore_state["status"] = "decompressing"
        restore_state["progress"] = 5
        
        total_bytes = os.path.getsize(f_path)
        bytes_read = 0
        
        with open(f_path, 'rb') as f_comp:
            # We wrap with gzip.GzipFile to decompress chunk by chunk
            with gzip.GzipFile(fileobj=f_comp) as f_in:
                with open(temp_restored_path, 'wb') as f_out:
                    while True:
                         chunk = f_in.read(65536)
                         if not chunk:
                             break
                         f_out.write(chunk)
                         bytes_read = f_comp.tell()
                         # Map decompression progress from 5 to 50
                         pct = 5 + int((bytes_read / total_bytes) * 45)
                         restore_state["progress"] = min(50, pct)
                         time.sleep(0.01)
                         
        # Phase 2: Verifying
        restore_state["status"] = "verifying integrity"
        restore_state["progress"] = 55
        
        conn = sqlite3.connect(temp_restored_path)
        try:
            res = conn.execute("PRAGMA integrity_check").fetchone()
            if not res or res[0] != "ok":
                raise ValueError(f"Integrity check failed: {res[0] if res else 'No response'}")
        finally:
            conn.close()

        # Phase 3: Restoring
        restore_state["status"] = "restoring database pages"
        restore_state["progress"] = 60
        
        def progress_callback(status, remaining, total):
            if total > 0:
                pct = 60 + int(((total - remaining) / total) * 38)
                restore_state["progress"] = min(98, pct)
                restore_state["status"] = f"restoring pages ({total - remaining}/{total})"
                
        src_conn = sqlite3.connect(temp_restored_path)
        dest_conn = sqlite3.connect(database.DB_PATH)
        try:
            src_conn.backup(dest_conn, pages=5, progress=progress_callback)
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
            
        restore_state["progress"] = 100
        restore_state["status"] = "completed"
    except Exception as e:
        restore_state["status"] = "failed"
        restore_state["error"] = str(e)
    finally:
        if os.path.exists(temp_restored_path):
            try:
                os.remove(temp_restored_path)
            except Exception:
                pass

@router.post("/db-backups/{filename}/restore-async")
def restore_db_backup_async(filename: str, background_tasks: BackgroundTasks):
    global restore_state
    restore_state = {
        "status": "idle",
        "progress": 0,
        "error": None
    }
    background_tasks.add_task(run_restore_task, filename)
    return {"status": "started"}

@router.get("/db-backups/restore-progress")
def get_restore_progress():
    def event_stream():
        global restore_state
        while True:
            status = restore_state["status"]
            progress = restore_state["progress"]
            error = restore_state["error"]
            
            yield f"data: {{\"status\": \"{status}\", \"progress\": {progress}, \"error\": {('\"' + error + '\"') if error else 'null'}}}\n\n"
            
            if status in ["completed", "failed"]:
                break
                
            time.sleep(0.3)
            
    return StreamingResponse(event_stream(), media_type="text/event-stream")
