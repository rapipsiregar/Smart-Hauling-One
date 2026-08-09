"""SQLite access for the ``trucks`` master registry.

The authoritative list of OHT/Water-Truck units, imported from the operator's own
spreadsheet (``app/services/master_import.py``). Replaces the ad-hoc
``data/registered_trucks.json`` as the source of truth for what a real truck is.

Two identifiers per unit, both unique:

``hull_id``
    The operator's own format, e.g. ``"HD 2152"``. What the UI displays and what
    reports reconcile against.
``hull_code``
    The bare 4 digits, e.g. ``"2152"``. All a gate camera can actually read, so
    this is the key OCR matches into (``app/services/hull_matcher.py``).

Pure persistence: no validation or matching logic lives here.
"""

from __future__ import annotations

import sqlite3

from app.core.database import connect

SCHEMA = """
CREATE TABLE IF NOT EXISTS trucks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    hull_id      TEXT UNIQUE NOT NULL,
    hull_code    TEXT UNIQUE NOT NULL,
    contractor   TEXT,
    unit_type    TEXT,
    brand        TEXT,
    model_type   TEXT,
    year         INTEGER,
    status       TEXT,
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trucks_hull_code ON trucks(hull_code);
CREATE INDEX IF NOT EXISTS idx_trucks_contractor ON trucks(contractor);
"""

FIELDS = (
    "hull_id", "hull_code", "contractor", "unit_type",
    "brand", "model_type", "year", "status",
)


def ensure_schema() -> None:
    """Create the ``trucks`` table and its indexes (idempotent)."""
    conn = connect()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def upsert_many(rows: list[dict]) -> dict:
    """Insert or update units keyed by ``hull_id``. Returns counts.

    Idempotent: re-importing the same sheet updates in place rather than
    duplicating, so a corrected spreadsheet can simply be re-imported.
    """
    ensure_schema()
    conn = connect()
    inserted = updated = 0
    try:
        for row in rows:
            values = [row.get(f) for f in FIELDS]
            existing = conn.execute(
                "SELECT id FROM trucks WHERE hull_id = ?", (row["hull_id"],)
            ).fetchone()
            if existing:
                assignments = ", ".join(f"{f} = ?" for f in FIELDS)
                conn.execute(
                    f"UPDATE trucks SET {assignments}, updated_at = datetime('now') "
                    "WHERE hull_id = ?",
                    [*values, row["hull_id"]],
                )
                updated += 1
            else:
                placeholders = ", ".join("?" for _ in FIELDS)
                conn.execute(
                    f"INSERT INTO trucks ({', '.join(FIELDS)}) VALUES ({placeholders})",
                    values,
                )
                inserted += 1
        conn.commit()
    except sqlite3.IntegrityError as err:  # pragma: no cover - duplicate hull_code
        conn.rollback()
        raise ValueError(f"master import violates a uniqueness rule: {err}") from err
    finally:
        conn.close()
    return {"inserted": inserted, "updated": updated}


def list_all() -> list[dict]:
    ensure_schema()
    conn = connect(rows=True)
    try:
        return [
            dict(r) for r in conn.execute("SELECT * FROM trucks ORDER BY hull_id ASC")
        ]
    finally:
        conn.close()


def all_hull_codes() -> list[str]:
    """Every ``hull_code``, for the fuzzy matcher's candidate set."""
    ensure_schema()
    conn = connect()
    try:
        return [r[0] for r in conn.execute("SELECT hull_code FROM trucks")]
    finally:
        conn.close()


def get_by_hull_code(hull_code: str) -> dict | None:
    ensure_schema()
    conn = connect(rows=True)
    try:
        row = conn.execute(
            "SELECT * FROM trucks WHERE hull_code = ?", (hull_code,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_by_hull_id(hull_id: str) -> dict | None:
    ensure_schema()
    conn = connect(rows=True)
    try:
        row = conn.execute("SELECT * FROM trucks WHERE hull_id = ?", (hull_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def master_version() -> int:
    """A monotonic version for the whole roster.

    Edge devices replicate the master and must know when to re-pull it. Rather
    than add a bookkeeping table, the version is derived from the roster itself:
    row count plus the newest updated_at. Any insert, delete, or edit moves it,
    which is exactly the condition a replica cares about.
    """
    import zlib

    ensure_schema()
    conn = connect()
    try:
        row = conn.execute(
            "SELECT COUNT(*), COALESCE(MAX(updated_at), '') FROM trucks"
        ).fetchone()
    finally:
        conn.close()
    payload = f"{row[0]}:{row[1]}".encode("utf-8")
    return zlib.crc32(payload) % 2_000_000_000


def count() -> int:
    ensure_schema()
    conn = connect()
    try:
        return int(conn.execute("SELECT COUNT(*) FROM trucks").fetchone()[0])
    finally:
        conn.close()


def clear() -> int:
    """Remove every master row. Returns how many were deleted."""
    ensure_schema()
    conn = connect()
    try:
        cur = conn.execute("DELETE FROM trucks")
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()
