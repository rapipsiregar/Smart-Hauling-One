"""Backup status and on-demand snapshots."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.services import backup, backup_scheduler

router = APIRouter(tags=["backup"])


@router.get("/backups")
def list_backups():
    """What backups exist, newest first, and whether the newest is intact.

    Only the newest is verified on this call: ``PRAGMA integrity_check`` reads
    the whole file, and checking a month of them would turn a status endpoint
    into a disk scan. The newest is the one that would actually be restored, and
    every backup was verified when it was written.
    """
    backups = backup.list_backups()
    entries = []
    for path in backups:
        stat = path.stat()
        entries.append({
            "name": path.name,
            "sizeBytes": stat.st_size,
            "createdAt": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
        })
    return {
        "enabled": not backup_scheduler.DISABLED,
        "intervalSeconds": backup_scheduler.INTERVAL_SEC,
        "keepDays": backup.KEEP_DAYS,
        "directory": str(backup.BACKUP_DIR),
        "count": len(entries),
        "latestVerified": backup.verify(backups[0]) if backups else False,
        "backups": entries,
    }


@router.post("/backups")
def create_backup():
    """Take a snapshot now, verify it, and prune old ones.

    Answers 500 when the snapshot fails verification rather than reporting
    success over a file that could not be restored -- the whole point of the
    check is that nobody finds out at the moment they need it.
    """
    try:
        return backup.run()
    except Exception as err:
        return JSONResponse({"error": f"Backup gagal: {err}"}, status_code=500)
