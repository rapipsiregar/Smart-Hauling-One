import threading
import time
import sqlite3
from backend import database

def perform_integrity_check() -> bool:
    try:
        conn = sqlite3.connect(database.DB_PATH)
        try:
            cursor = conn.cursor()
            res = cursor.execute("PRAGMA integrity_check").fetchone()
            if res and res[0] == "ok":
                database.log_audit(
                    action="db_integrity_success",
                    details="SQLite structural database integrity verified successfully."
                )
                return True
            else:
                detail_msg = res[0] if res else "No response from database"
                database.log_audit(
                    action="db_integrity_failure",
                    details=f"Database integrity check failed: {detail_msg}"
                )
                return False
        finally:
            conn.close()
    except Exception as e:
        try:
            database.log_audit(
                action="db_integrity_error",
                details=f"Error executing database integrity check: {str(e)}"
            )
        except Exception:
            pass
        return False

def scheduler_loop():
    # Perform startup check
    perform_integrity_check()
    while True:
        # Sleep for 7 days (7 * 24 * 3600 seconds)
        time.sleep(604800)
        try:
            perform_integrity_check()
        except Exception as e:
            print(f"Error during scheduled database integrity check: {e}")

def start_integrity_scheduler():
    t = threading.Thread(target=scheduler_loop, daemon=True)
    t.start()
