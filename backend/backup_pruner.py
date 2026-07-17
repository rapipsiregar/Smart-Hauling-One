import os
import shutil
from datetime import datetime, timedelta
from backend import database

def run_backup_pruning(days_threshold=7, min_free_mb=50.0):
    pruned_files = []
    db_dir = os.path.dirname(database.DB_PATH) or "data"
    
    if not os.path.exists(db_dir):
        return pruned_files, shutil.disk_usage(".").free

    # 1. Collect all backup files matching backup_*.db.gz
    backup_files = []
    for filename in os.listdir(db_dir):
        if filename.startswith("backup_") and filename.endswith(".db.gz"):
            filepath = os.path.join(db_dir, filename)
            # Try parsing timestamp from filename e.g. backup_20260717_094500.db.gz
            try:
                parts = filename.split("_")
                if len(parts) >= 3:
                    ts_str = f"{parts[1]}_{parts[2].split('.')[0]}"
                    file_dt = datetime.strptime(ts_str, "%Y%m%d_%H%M%S")
                else:
                    file_dt = datetime.utcfromtimestamp(os.path.getmtime(filepath))
            except Exception:
                file_dt = datetime.utcfromtimestamp(os.path.getmtime(filepath))
            
            backup_files.append({
                "filename": filename,
                "filepath": filepath,
                "datetime": file_dt,
                "size_bytes": os.path.getsize(filepath)
            })

    # Sort backup files oldest to newest
    backup_files.sort(key=lambda x: x["datetime"])
    now = datetime.utcnow()
    cutoff_date = now - timedelta(days=days_threshold)

    # 2. Prune files older than 7 days
    remaining_backups = []
    for bf in backup_files:
        if bf["datetime"] < cutoff_date:
            try:
                os.remove(bf["filepath"])
                pruned_files.append(bf["filename"])
                try:
                    database.log_audit(
                        action="backup_pruning",
                        details=f"Pruned database backup {bf['filename']} (Age: >{days_threshold} days).",
                        operator="system"
                    )
                except Exception:
                    pass
            except Exception as e:
                print(f"Error removing backup file {bf['filename']}: {e}")
        else:
            remaining_backups.append(bf)

    # 3. Disk space watchdog: if free space < min_free_mb, prune oldest remaining backups
    usage = shutil.disk_usage(db_dir)
    free_mb = usage.free / (1024.0 * 1024.0)
    
    while free_mb < min_free_mb and remaining_backups:
        # Dequeue the oldest backup
        bf = remaining_backups.pop(0)
        try:
            os.remove(bf["filepath"])
            pruned_files.append(bf["filename"])
            try:
                database.log_audit(
                    action="backup_pruning",
                    details=f"Critical: Pruned database backup {bf['filename']} to recover low disk space (Free: {free_mb:.1f}MB).",
                    operator="system"
                )
            except Exception:
                pass
            # Recheck disk space
            usage = shutil.disk_usage(db_dir)
            free_mb = usage.free / (1024.0 * 1024.0)
        except Exception as e:
            print(f"Error removing backup file {bf['filename']}: {e}")
            break

    return pruned_files, free_mb
