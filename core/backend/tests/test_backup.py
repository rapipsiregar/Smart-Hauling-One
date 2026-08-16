"""Backups, and the promise that a backup is restorable.

The gap this closes: a single corrupted or deleted database file loses every
ritase the site ever recorded. The gates' outboxes hold only what the core has
not yet acknowledged, so once a crossing is ingested the core's copy is the only
copy.

The tests that matter most here are the negative ones. A backup that exists but
cannot be restored is worse than no backup, because it is believed.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta

import pytest

from app.services import backup


@pytest.fixture
def backup_dir(tmp_path, monkeypatch):
    directory = tmp_path / "backups"
    monkeypatch.setattr(backup, "BACKUP_DIR", directory)
    return directory


# --- taking one --------------------------------------------------------------

def test_a_backup_is_created_and_restorable(backup_dir):
    path = backup.create()
    assert path.exists()
    assert path.parent == backup_dir
    # Restorable means: opens, and the table the system is about is readable.
    conn = sqlite3.connect(path)
    try:
        conn.execute("SELECT COUNT(*) FROM video_results").fetchone()
    finally:
        conn.close()


def test_the_backup_carries_the_data_that_was_there(backup_dir):
    """A snapshot that opens but is empty would pass a shallower test."""
    from app.core.database import connect

    live = connect()
    try:
        expected = live.execute("SELECT COUNT(*) FROM cameras").fetchone()[0]
    finally:
        live.close()

    path = backup.create()
    conn = sqlite3.connect(path)
    try:
        assert conn.execute("SELECT COUNT(*) FROM cameras").fetchone()[0] == expected
    finally:
        conn.close()


# --- refusing a bad one ------------------------------------------------------

def test_a_corrupt_file_fails_verification(backup_dir):
    backup_dir.mkdir(parents=True, exist_ok=True)
    rubbish = backup_dir / "smart_gate-20260101T000000.db"
    rubbish.write_bytes(b"this is not a database")
    assert backup.verify(rubbish) is False


def test_an_empty_file_fails_verification(backup_dir):
    backup_dir.mkdir(parents=True, exist_ok=True)
    empty = backup_dir / "smart_gate-20260101T000000.db"
    empty.touch()
    assert backup.verify(empty) is False


def test_a_valid_sqlite_file_that_is_not_this_database_fails(backup_dir):
    """Structurally sound is not the same as restorable."""
    backup_dir.mkdir(parents=True, exist_ok=True)
    other = backup_dir / "smart_gate-20260101T000000.db"
    conn = sqlite3.connect(other)
    conn.execute("CREATE TABLE sesuatu (id INTEGER)")
    conn.commit()
    conn.close()
    assert backup.verify(other) is False


def test_a_missing_file_fails_verification(backup_dir):
    assert backup.verify(backup_dir / "tidak-ada.db") is False


# --- pruning -----------------------------------------------------------------

def _fake(backup_dir, stamp: str):
    backup_dir.mkdir(parents=True, exist_ok=True)
    path = backup_dir / f"smart_gate-{stamp}.db"
    path.write_bytes(b"x")
    return path


def test_pruning_keeps_one_per_day(backup_dir):
    """Several snapshots from one afternoon are near-duplicates."""
    now = datetime(2026, 8, 16, 12, 0, 0)
    for stamp in ("20260816T060000", "20260816T090000", "20260816T120000"):
        _fake(backup_dir, stamp)

    backup.prune(keep_days=30, now=now)
    remaining = {p.name for p in backup.list_backups()}
    assert remaining == {"smart_gate-20260816T120000.db"}


def test_pruning_drops_days_past_the_window(backup_dir):
    now = datetime(2026, 8, 16, 12, 0, 0)
    fresh = _fake(backup_dir, "20260816T060000")
    old = _fake(backup_dir, (now - timedelta(days=45)).strftime(backup.STAMP))

    removed = backup.prune(keep_days=30, now=now)
    assert old.name in {p.name for p in removed}
    assert fresh.exists()


def test_the_newest_backup_is_never_pruned(backup_dir):
    """A site idle for a month must not prune itself down to nothing."""
    now = datetime(2026, 8, 16, 12, 0, 0)
    ancient = _fake(backup_dir, (now - timedelta(days=400)).strftime(backup.STAMP))

    backup.prune(keep_days=30, now=now)
    assert ancient.exists()


def test_pruning_an_empty_directory_is_harmless(backup_dir):
    assert backup.prune(now=datetime(2026, 8, 16)) == []


# --- the API -----------------------------------------------------------------

def test_status_endpoint_reports_the_newest_as_verified(client, backup_dir):
    client.post("/api/backups")
    body = client.get("/api/backups").json()
    assert body["count"] >= 1
    assert body["latestVerified"] is True
    assert body["keepDays"] == backup.KEEP_DAYS


def test_creating_through_the_api_returns_what_it_did(client, backup_dir):
    body = client.post("/api/backups").json()
    assert body["created"].startswith("smart_gate-")
    assert body["sizeBytes"] > 0
    assert body["totalBackups"] >= 1
