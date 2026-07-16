import sqlite3
from typing import List, Dict, Any
from backend.database import get_db_connection

def init_stats_db():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_contractor_stats (
            date TEXT NOT NULL,
            contractor TEXT NOT NULL,
            crossings INTEGER NOT NULL DEFAULT 0,
            cycles INTEGER NOT NULL DEFAULT 0,
            active_hours REAL NOT NULL DEFAULT 0.0,
            PRIMARY KEY (date, contractor)
        )
        """)
        conn.commit()
    finally:
        conn.close()

def get_all_daily_stats() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        rows = conn.execute("SELECT date, contractor, crossings, cycles, active_hours FROM daily_contractor_stats").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def upsert_daily_stat(date_str: str, contractor: str, crossings: int, cycles: int, active_hours: float):
    conn = get_db_connection()
    try:
        conn.execute("""
            INSERT INTO daily_contractor_stats (date, contractor, crossings, cycles, active_hours)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(date, contractor) DO UPDATE SET
                crossings = crossings + excluded.crossings,
                cycles = cycles + excluded.cycles,
                active_hours = MAX(active_hours, excluded.active_hours)
        """, (date_str, contractor, crossings, cycles, active_hours))
        conn.commit()
    finally:
        conn.close()

def delete_crossing(crossing_id: int):
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM crossings WHERE id = ?", (crossing_id,))
        conn.commit()
    finally:
        conn.close()
