import os
import sqlite3
import time
import threading
from datetime import datetime, timedelta
from backend import database

def perform_vacuum():
    db_path = os.environ.get("SQLITE_DB_PATH", "data/smart_gate.db")
    if not os.path.exists(db_path):
        return
        
    size_before = os.path.getsize(db_path)
    
    conn = database.get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        cursor.execute("PRAGMA optimize")
        cursor.execute("VACUUM")
        conn.commit()
        
        size_after = os.path.getsize(db_path)
        reduction = size_before - size_after
        
        database.log_audit(
            action="db_vacuum",
            details=f"Auto DB Vacuum defragmentation completed. Size before: {size_before} bytes, after: {size_after} bytes. Reduced by: {reduction} bytes.",
            operator="system"
        )
    except Exception as e:
        print(f"Error executing DB vacuum: {e}")
    finally:
        conn.close()

def scheduler_loop():
    time.sleep(30)
    while True:
        try:
            interval_days = int(database.get_system_setting("db_vacuum_interval_days", "7"))
        except:
            interval_days = 7
            
        try:
            conn = database.get_db_connection()
            row = conn.execute("SELECT timestamp FROM audit_logs WHERE action = 'db_vacuum' ORDER BY timestamp DESC LIMIT 1").fetchone()
            conn.close()
            
            should_vacuum = False
            if not row:
                should_vacuum = True
            else:
                try:
                    last_vacuum_time = datetime.fromisoformat(row[0])
                    if datetime.utcnow() - last_vacuum_time >= timedelta(days=interval_days):
                        should_vacuum = True
                except:
                    should_vacuum = True
                    
            if should_vacuum:
                perform_vacuum()
        except Exception as e:
            print(f"Error in vacuum scheduler loop: {e}")
            
        time.sleep(600)

def start_vacuum_scheduler():
    t = threading.Thread(target=scheduler_loop, daemon=True)
    t.start()
