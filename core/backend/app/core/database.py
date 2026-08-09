"""SQLite connection factory shared by every repository."""

from __future__ import annotations

import sqlite3

from app.core.config import DB_PATH


def connect(*, rows: bool = False) -> sqlite3.Connection:
    """Open a connection to the Integrated Smart Hauling System database.

    Set ``rows=True`` to get ``sqlite3.Row`` access (dict-like columns);
    leave it False for positional/index access.
    """
    conn = sqlite3.connect(DB_PATH)
    if rows:
        conn.row_factory = sqlite3.Row
    return conn
