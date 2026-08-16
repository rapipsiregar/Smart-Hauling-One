"""SQLite connection factory shared by every repository."""

from __future__ import annotations

import sqlite3

from app.core.config import DB_PATH

# How long a statement waits for a lock before giving up.
#
# The default is ZERO: a writer that finds the database busy fails immediately
# with "database is locked". With four gates submitting crossings into the same
# file that is not a rare race, it is the normal case — and a failed insert
# there means the device retries from its outbox, so the crossing is not lost
# but the log fills with errors that look like a fault. Ten seconds is far
# longer than any write here takes and turns contention into a short wait.
BUSY_TIMEOUT_MS = 10_000

# Set once per process. WAL is a property of the database FILE, not of a
# connection, so re-issuing it on every connect is wasted work.
_WAL_READY = False


def _configure(conn: sqlite3.Connection) -> None:
    """Apply the pragmas every connection needs.

    WAL is what lets readers and writers coexist: in the default rollback
    journal a single reader blocks every writer for as long as it holds the
    connection, and this codebase has reads that walk large result sets. Under
    WAL a reader sees a consistent snapshot while writers carry on appending,
    which is exactly the four-gates-plus-a-dashboard shape.
    """
    global _WAL_READY
    conn.execute(f"PRAGMA busy_timeout = {BUSY_TIMEOUT_MS}")
    if not _WAL_READY:
        try:
            conn.execute("PRAGMA journal_mode = WAL")
            # Durability stays high enough for this workload: WAL + NORMAL loses
            # nothing on process crash, only on host power loss mid-commit, and
            # every crossing is still held in the device's outbox until the core
            # acknowledges it. FULL would fsync on every insert for a guarantee
            # the outbox already provides.
            conn.execute("PRAGMA synchronous = NORMAL")
            _WAL_READY = True
        except sqlite3.DatabaseError:
            # A read-only mount or a file already open elsewhere in another mode.
            # Not fatal: the connection still works, just without WAL.
            pass


def connect(*, rows: bool = False) -> sqlite3.Connection:
    """Open a connection to the Integrated Smart Hauling System database.

    Set ``rows=True`` to get ``sqlite3.Row`` access (dict-like columns);
    leave it False for positional/index access.
    """
    conn = sqlite3.connect(DB_PATH)
    if rows:
        conn.row_factory = sqlite3.Row
    _configure(conn)
    return conn
