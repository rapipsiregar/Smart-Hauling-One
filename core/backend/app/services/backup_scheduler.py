"""Runs the backup on a timer for the lifetime of a served application.

A backup that only exists as a command somebody remembers to type is not a
backup strategy, so this runs unattended. It is deliberately dumb -- a thread
and a sleep, no scheduler dependency -- because the failure mode of a cron
library nobody understands at 2am is worse than the failure mode of ten lines
that are obvious.

The interval is deliberately long and the first run is immediate: the most
likely moment to discover there is no backup is the moment the database is
already gone, so a fresh deployment gets one within seconds of booting.
"""

from __future__ import annotations

import os
import threading

from app.services import backup

# Every six hours. Frequent enough that a failure loses part of a shift rather
# than a day; rare enough that the snapshots do not dominate disk on a site
# whose whole database is tens of megabytes.
INTERVAL_SEC = int(os.environ.get("SMART_GATE_BACKUP_INTERVAL_SEC", 6 * 60 * 60))

# Set SMART_GATE_DISABLE_BACKUP=true where backups are handled outside the app
# (a managed database, a volume snapshot) so it does not duplicate them.
DISABLED = os.environ.get("SMART_GATE_DISABLE_BACKUP", "").strip().lower() in (
    "1", "true", "yes",
)

_stop = threading.Event()
_thread: threading.Thread | None = None


def _loop() -> None:
    while not _stop.is_set():
        try:
            result = backup.run()
            print(
                f"backup: {result['created']} "
                f"({result['sizeBytes'] / 1_048_576:.1f} MB), "
                f"{len(result['removed'])} dibuang, "
                f"{result['totalBackups']} tersimpan"
            )
        except Exception as err:
            # Never let a failed backup take the API down with it. The gates keep
            # ingesting; the operator needs to see this in the log, not a 500.
            print(f"backup: GAGAL — {err}")
        # wait() rather than sleep() so shutdown is immediate instead of blocking
        # for up to six hours.
        _stop.wait(INTERVAL_SEC)


def start() -> None:
    global _thread
    if DISABLED:
        print("backup: dinonaktifkan (SMART_GATE_DISABLE_BACKUP)")
        return
    if _thread is not None and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, name="backup", daemon=True)
    _thread.start()


def stop() -> None:
    _stop.set()
