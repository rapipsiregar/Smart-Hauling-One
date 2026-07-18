import os
import threading
import time
from datetime import datetime, timedelta, time as dt_time
from backend import backup_service, database


def get_seconds_until_next_run(target_hour: int = 0, target_minute: int = 1) -> float:
    now = datetime.now()
    target_today = datetime.combine(now.date(), dt_time(target_hour, target_minute))
    if now < target_today:
        delta = target_today - now
    else:
        target_tomorrow = datetime.combine(now.date() + timedelta(days=1), dt_time(target_hour, target_minute))
        delta = target_tomorrow - now
    return delta.total_seconds()


def scheduler_loop():
    if os.environ.get("DISABLE_AUTO_BACKUP", "false").lower() == "true":
        print("Automatic database backup scheduler disabled via environment variable.")
        return

    while True:
        sleep_seconds = get_seconds_until_next_run(0, 1)
        time.sleep(sleep_seconds)
        if database.get_system_setting("auto_backup_enabled", "true").lower() == "false":
            continue
        try:
            backup_service.perform_backup()
        except Exception as e:
            print(f"Error during automatic database backup: {e}")


def start_backup_scheduler():
    t = threading.Thread(target=scheduler_loop, daemon=True)
    t.start()


