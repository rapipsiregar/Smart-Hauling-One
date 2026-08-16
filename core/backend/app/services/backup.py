"""Database backups.

Today a single corrupted or deleted file loses every ritase the site has ever
recorded. There is no replica: the gates' outboxes only hold what the core has
not yet acknowledged, so once a crossing is ingested the core's copy is the only
copy. That makes this the largest reliability gap in the system, and the one no
change of stack or framework would have closed.

Two things make this correct rather than merely present:

* ``sqlite3.Connection.backup`` is used, not a file copy. Copying a live SQLite
  file yields a torn database whenever a write lands mid-copy -- and under WAL
  the committed data may be in the ``-wal`` sidecar that a naive copy misses
  entirely. The backup API takes a consistent snapshot of a live database.
* Every backup is verified by opening it and running an integrity check before
  it is allowed to replace an older one. An unverified backup is a belief, not a
  backup, and the moment you find out is the moment you needed it.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

from app.core.config import DB_PATH
from app.core.database import connect

BACKUP_DIR = DB_PATH.parent / "backups"

# Backups older than this are pruned, EXCEPT the newest of each day (see
# ``prune``). Ritase history is operational evidence that gets reconciled
# against a contractor's paperwork weeks later, so a week of dailies is the
# floor, not the target.
KEEP_DAYS = 30

# Filenames sort chronologically, which is what makes "newest" a sort rather
# than a stat call on every file.
STAMP = "%Y%m%dT%H%M%S"


def backup_path(moment: datetime | None = None) -> Path:
    stamp = (moment or datetime.now()).strftime(STAMP)
    return BACKUP_DIR / f"smart_gate-{stamp}.db"


def verify(path: Path) -> bool:
    """Open the backup and ask SQLite whether it is intact.

    ``PRAGMA integrity_check`` walks the whole file: pages, indexes, and the
    links between them. A backup that cannot answer "ok" here is not written off
    as merely suspect -- it is discarded, because keeping it would let it be
    restored later in the belief that it was checked.
    """
    if not path.exists() or path.stat().st_size == 0:
        return False
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        try:
            result = conn.execute("PRAGMA integrity_check").fetchone()
            if not result or result[0] != "ok":
                return False
            # A structurally sound file that is not THIS database is no use
            # either, so confirm the table the whole system is about is there.
            conn.execute("SELECT COUNT(*) FROM video_results").fetchone()
        finally:
            conn.close()
    except sqlite3.DatabaseError:
        return False
    return True


def create() -> Path:
    """Take one verified snapshot. Returns its path.

    Raises ``RuntimeError`` if the snapshot fails verification, rather than
    returning a path to a file that cannot be restored.
    """
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    destination = backup_path()

    source = connect()
    try:
        target = sqlite3.connect(destination)
        try:
            # The online backup API: a consistent snapshot of a live database,
            # including anything sitting in the WAL that a file copy would miss.
            source.backup(target)
        finally:
            target.close()
    finally:
        source.close()

    if not verify(destination):
        # Do not leave a file that looks like a backup and is not one.
        destination.unlink(missing_ok=True)
        raise RuntimeError(f"backup failed verification: {destination.name}")
    return destination


def list_backups() -> list[Path]:
    """Existing backups, newest first."""
    if not BACKUP_DIR.is_dir():
        return []
    return sorted(BACKUP_DIR.glob("smart_gate-*.db"), reverse=True)


def prune(keep_days: int = KEEP_DAYS, now: datetime | None = None) -> list[Path]:
    """Delete old backups, keeping the newest of each day. Returns what went.

    Thinning by day rather than deleting wholesale: several snapshots from one
    afternoon are near-duplicates, while one snapshot per day going back a month
    is what lets somebody answer "what did the sheet say on the 3rd" after a
    contractor disputes it.

    The newest backup is never deleted, whatever its age -- a system that has
    been idle for a month must not prune itself down to nothing.
    """
    backups = list_backups()
    if not backups:
        return []

    cutoff = (now or datetime.now()) - timedelta(days=keep_days)
    newest_per_day: dict[str, Path] = {}
    for path in backups:  # newest first, so the first seen wins its day
        day = path.stem.split("-", 1)[1][:8]
        newest_per_day.setdefault(day, path)

    keep = set(newest_per_day.values())
    keep.add(backups[0])

    removed: list[Path] = []
    for path in backups:
        if path in keep:
            stamp = path.stem.split("-", 1)[1]
            try:
                taken = datetime.strptime(stamp, STAMP)
            except ValueError:
                continue
            if taken >= cutoff or path is backups[0]:
                continue
        path.unlink(missing_ok=True)
        removed.append(path)
    return removed


def run(keep_days: int = KEEP_DAYS) -> dict:
    """Take a backup and prune old ones. The whole job, for a scheduler or CLI."""
    created = create()
    removed = prune(keep_days)
    return {
        "created": created.name,
        "sizeBytes": created.stat().st_size,
        "removed": [p.name for p in removed],
        "totalBackups": len(list_backups()),
    }
