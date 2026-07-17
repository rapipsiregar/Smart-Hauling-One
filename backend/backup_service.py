import os
import gzip
import shutil
import sqlite3
import asyncio
from datetime import datetime
from backend import database

def perform_backup() -> str:
    db_dir = os.path.dirname(database.DB_PATH) or "data"
    os.makedirs(db_dir, exist_ok=True)
    
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    temp_backup_path = f"{database.DB_PATH}.backup"
    final_backup_path = os.path.join(db_dir, f"backup_{timestamp}.db.gz")
    
    src_conn = sqlite3.connect(database.DB_PATH)
    dest_conn = sqlite3.connect(temp_backup_path)
    try:
        src_conn.backup(dest_conn)
    finally:
        dest_conn.close()
        src_conn.close()
        
    try:
        with open(temp_backup_path, 'rb') as f_in:
            with gzip.open(final_backup_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
    finally:
        if os.path.exists(temp_backup_path):
            os.remove(temp_backup_path)
            
    temp_check_path = f"{final_backup_path}.integrity_temp"
    integrity_ok = False
    error_msg = ""
    try:
        with gzip.open(final_backup_path, 'rb') as f_in:
            with open(temp_check_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        
        conn = sqlite3.connect(temp_check_path)
        try:
            cursor = conn.cursor()
            res = cursor.execute("PRAGMA integrity_check").fetchone()
            if res and res[0] == "ok":
                integrity_ok = True
            else:
                error_msg = f"Integrity check failed: {res[0] if res else 'No response'}"
        finally:
            conn.close()
    except Exception as e:
        error_msg = f"Exception during integrity check: {str(e)}"
    finally:
        if os.path.exists(temp_check_path):
            os.remove(temp_check_path)

    if not integrity_ok:
        from backend.alerts_dispatcher import trigger_backup_integrity_alert
        from backend.websocket_manager import manager
        alert = trigger_backup_integrity_alert(os.path.basename(final_backup_path), error_msg)
        if alert:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(manager.broadcast(alert))
            except Exception:
                pass
        try:
            database.log_audit(
                action="db_backup_corrupt",
                details=f"Backup integrity verification failed for {os.path.basename(final_backup_path)}: {error_msg}",
                operator="system"
            )
        except Exception:
            pass
    else:
        try:
            database.log_audit(
                action="db_auto_backup",
                details=f"Database backup created and verified: {os.path.basename(final_backup_path)}"
            )
        except Exception:
            pass
            
    return final_backup_path

async def backup_loop_worker():
    await asyncio.sleep(60)
    while True:
        try:
            perform_backup()
        except Exception as e:
            print(f"Error performing automatic database backup: {e}")
        await asyncio.sleep(600)
