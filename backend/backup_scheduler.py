import threading
import time
import sqlite3
import os
from datetime import datetime
from backend.database import DB_PATH

BACKUPS_DIR = "data/backups"

def perform_db_backup():
    try:
        os.makedirs(BACKUPS_DIR, exist_ok=True)
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        backup_file = os.path.join(BACKUPS_DIR, f"smart_gate_{timestamp}.db")
        
        # Connect to source and destination
        src_conn = sqlite3.connect(DB_PATH)
        dst_conn = sqlite3.connect(backup_file)
        
        with dst_conn:
            src_conn.backup(dst_conn)
            
        dst_conn.close()
        src_conn.close()
        print(f"Automatic database backup created successfully: {backup_file}")
    except Exception as e:
        print(f"Error during automatic database backup: {e}")

def scheduler_loop():
    # Perform initial backup on startup, then wait 24 hours
    perform_db_backup()
    while True:
        # Sleep for 24 hours (86400 seconds)
        time.sleep(86400)
        perform_db_backup()

def start_backup_scheduler():
    t = threading.Thread(target=scheduler_loop, daemon=True)
    t.start()
