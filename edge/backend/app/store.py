"""On-device SQLite: the master replica and this gate's own crossings.

The edge keeps its own copy of both so it stays useful when the link to the core
is down -- which is the whole point of running a full stack at the gate. The
master replica is pulled from the core by version (never edited here); crossings
are written locally first and then drained to the core by the outbox.

Deliberately separate from ``agent/outbox.py``: the outbox is a delivery queue
that empties, whereas this is the gate's own readable history and roster.
"""

from __future__ import annotations

import os
import sqlite3
import threading
from pathlib import Path

DB_PATH = Path(os.environ.get("SMART_GATE_EDGE_DB", "./data/edge.db"))

# A Jetson has finite disk. Keeping the most recent N is enough for the "what did
# this gate just see" question these images exist to answer; anything older is a
# job for the core, which keeps them permanently.
SNAPSHOT_KEEP = int(os.environ.get("SMART_GATE_SNAPSHOT_KEEP", "500"))


def snapshot_dir() -> Path:
    """The gate's OWN copy of each crossing's crop.

    Deliberately separate from agent/outbox.py's snapshot dir: the outbox deletes
    its copy the moment the core acknowledges delivery, because that one is a
    delivery payload, not a record. A technician asking "why did this truck read
    as 2152" needs the image to still be there afterwards.

    Resolved per call rather than at import. As a module constant the value was
    fixed by whichever test imported ``app.store`` first, which made the suite
    pass or fail on import order alone.
    """
    return Path(
        os.environ.get("SMART_GATE_CROSSING_SNAPSHOTS", "./data/crossing-snapshots")
    )

SCHEMA = """
CREATE TABLE IF NOT EXISTS trucks (
    hull_id    TEXT PRIMARY KEY,
    hull_code  TEXT UNIQUE NOT NULL,
    contractor TEXT,
    unit_type  TEXT,
    brand      TEXT,
    model_type TEXT,
    year       INTEGER,
    status     TEXT
);
CREATE INDEX IF NOT EXISTS idx_edge_trucks_code ON trucks(hull_code);

CREATE TABLE IF NOT EXISTS crossings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotency_key TEXT UNIQUE NOT NULL,
    hull_id         TEXT,
    raw_code        TEXT,
    match_outcome   TEXT,
    confidence      REAL,
    read_count      INTEGER,
    window_sec      REAL,
    votes_json      TEXT,
    snapshot_path   TEXT,
    detected_at     TEXT NOT NULL,
    synced          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_edge_crossings_time ON crossings(detected_at DESC);

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);
"""

_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_schema() -> None:
    with _lock, _connect() as conn:
        conn.executescript(SCHEMA)


# --- meta --------------------------------------------------------------------

def get_meta(key: str, default: str | None = None) -> str | None:
    ensure_schema()
    with _connect() as conn:
        row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_meta(key: str, value: str) -> None:
    ensure_schema()
    with _lock, _connect() as conn:
        conn.execute(
            "INSERT INTO meta (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, str(value)),
        )


# --- master replica ----------------------------------------------------------

def replace_master(trucks: list[dict], master_version: int) -> int:
    """Swap in a fresh master snapshot from the core. Returns rows stored.

    A full replace rather than a merge: the core is the sole author, so a
    partial local state is never something we want to preserve.
    """
    ensure_schema()
    with _lock, _connect() as conn:
        conn.execute("DELETE FROM trucks")
        conn.executemany(
            "INSERT INTO trucks (hull_id, hull_code, contractor, unit_type, brand, "
            "model_type, year, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    t["hull_id"], t["hull_code"], t.get("contractor"),
                    t.get("unit_type"), t.get("brand"), t.get("model_type"),
                    t.get("year"), t.get("status"),
                )
                for t in trucks
            ],
        )
    set_meta("master_version", str(master_version))
    return len(trucks)


def all_hull_codes() -> list[str]:
    ensure_schema()
    with _connect() as conn:
        return [r["hull_code"] for r in conn.execute("SELECT hull_code FROM trucks")]


def get_by_hull_code(hull_code: str) -> dict | None:
    ensure_schema()
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM trucks WHERE hull_code = ?", (hull_code,)
        ).fetchone()
    return dict(row) if row else None


def master_count() -> int:
    ensure_schema()
    with _connect() as conn:
        return int(conn.execute("SELECT COUNT(*) FROM trucks").fetchone()[0])


def master_version() -> int:
    return int(get_meta("master_version", "0") or 0)


# --- crossing snapshots ------------------------------------------------------

def save_snapshot(idempotency_key: str, jpeg: bytes | None) -> str | None:
    """Keep the gate's own copy of a crossing's crop. Returns its path.

    Called with the same bytes handed to the outbox, but written somewhere the
    outbox will not clean up. Failure to write is never allowed to lose the
    crossing itself -- an image is worth less than the record of a truck passing.
    """
    if not jpeg:
        return None
    try:
        directory = snapshot_dir()
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"{idempotency_key}.jpg"
        path.write_bytes(jpeg)
        prune_snapshots()
        return str(path)
    except OSError as err:  # full disk, read-only mount -- log and carry on
        print(f"store: could not save snapshot for {idempotency_key} ({err})")
        return None


def prune_snapshots(keep: int | None = None) -> int:
    """Drop the oldest images past the cap. Returns how many were removed."""
    keep = SNAPSHOT_KEEP if keep is None else keep
    directory = snapshot_dir()
    if not directory.exists():
        return 0
    images = sorted(directory.glob("*.jpg"), key=lambda p: p.stat().st_mtime)
    removed = 0
    for stale in images[: max(0, len(images) - keep)]:
        stale.unlink(missing_ok=True)
        removed += 1
    return removed


def snapshot_path_for(crossing_id: int) -> Path | None:
    """The stored image for one crossing, if it is still on disk."""
    ensure_schema()
    with _connect() as conn:
        row = conn.execute(
            "SELECT snapshot_path FROM crossings WHERE id = ?", (crossing_id,)
        ).fetchone()
    if row is None or not row["snapshot_path"]:
        return None
    path = Path(row["snapshot_path"])
    return path if path.exists() else None


# --- local crossings ---------------------------------------------------------

def record_crossing(**fields) -> int:
    """Store one locally-detected crossing. Ignores a repeat idempotency key."""
    ensure_schema()
    columns = (
        "idempotency_key", "hull_id", "raw_code", "match_outcome", "confidence",
        "read_count", "window_sec", "votes_json", "snapshot_path", "detected_at",
    )
    with _lock, _connect() as conn:
        cur = conn.execute(
            f"INSERT OR IGNORE INTO crossings ({', '.join(columns)}) "
            f"VALUES ({', '.join('?' for _ in columns)})",
            [fields.get(c) for c in columns],
        )
        return int(cur.lastrowid or 0)


def clear_crossings() -> dict:
    """Erase this gate's own crossing history and its stored crops.

    A development convenience, matching the core's reset: without it, clearing
    the centre leaves the gate still holding yesterday's readings, and a repeat
    test starts from two databases that disagree.

    The master replica is NOT touched. It comes from the core and re-pulling it
    costs a round trip the device may not be able to make -- and a gate with an
    empty roster resolves every truck to UNKNOWN, which looks like a broken
    detector rather than a cleared history.
    """
    ensure_schema()
    with _lock, _connect() as conn:
        removed = conn.execute("DELETE FROM crossings").rowcount

    images = 0
    directory = snapshot_dir()
    if directory.is_dir():
        for image in directory.glob("*.jpg"):
            image.unlink(missing_ok=True)
            images += 1
    return {"crossings": removed, "snapshots": images}


def mark_synced(idempotency_key: str) -> None:
    ensure_schema()
    with _lock, _connect() as conn:
        conn.execute(
            "UPDATE crossings SET synced = 1 WHERE idempotency_key = ?",
            (idempotency_key,),
        )


def recent_crossings(limit: int = 50) -> list[dict]:
    ensure_schema()
    with _connect() as conn:
        return [
            dict(r) for r in conn.execute(
                "SELECT * FROM crossings ORDER BY detected_at DESC, id DESC LIMIT ?",
                (limit,),
            )
        ]


def crossing_counts() -> dict:
    ensure_schema()
    with _connect() as conn:
        total = int(conn.execute("SELECT COUNT(*) FROM crossings").fetchone()[0])
        unsynced = int(
            conn.execute("SELECT COUNT(*) FROM crossings WHERE synced = 0").fetchone()[0]
        )
        identified = int(
            conn.execute(
                "SELECT COUNT(*) FROM crossings WHERE hull_id IS NOT NULL "
                "AND hull_id != 'UNKNOWN'"
            ).fetchone()[0]
        )
    return {"total": total, "unsynced": unsynced, "identified": identified}
