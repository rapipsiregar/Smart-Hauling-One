import threading
import time
from backend import backup_service

def scheduler_loop():
    while True:
        time.sleep(600)
        try:
            backup_service.perform_backup()
        except Exception as e:
            print(f"Error during automatic database backup: {e}")

def start_backup_scheduler():
    t = threading.Thread(target=scheduler_loop, daemon=True)
    t.start()
