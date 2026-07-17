import os
import sqlite3
from fastapi import APIRouter, HTTPException
from backend import database
from backend.database import get_db_connection

router = APIRouter(prefix="/admin", tags=["admin"])

@router.post("/db-vacuum")
async def db_vacuum():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        cursor.execute("PRAGMA optimize")
        cursor.execute("VACUUM")
        conn.commit()
        
        database.log_audit("db_vacuum", "Database vacuum and optimization executed", "admin")
        
        db_path = os.environ.get("SQLITE_DB_PATH", "data/smart_gate.db")
        db_size = os.path.getsize(db_path) if os.path.exists(db_path) else 0
        
        return {
            "status": "success",
            "message": "Database optimized and vacuumed successfully.",
            "database_size_bytes": db_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

from datetime import datetime

MIGRATIONS = {
    1: [
        "CREATE INDEX IF NOT EXISTS idx_crossings_hull_id ON crossings(hull_id)",
        "CREATE INDEX IF NOT EXISTS idx_crossings_timestamp ON crossings(timestamp)"
    ],
    2: [
        "CREATE TABLE IF NOT EXISTS schema_metadata (key TEXT PRIMARY KEY, value TEXT)"
    ],
    3: [
        "INSERT OR IGNORE INTO schema_metadata (key, value) VALUES ('schema_version', '3')"
    ]
}

def get_current_version(conn) -> int:
    conn.execute("""
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
    )
    """)
    row = conn.execute("SELECT MAX(version) FROM schema_migrations").fetchone()
    return row[0] if row and row[0] is not None else 0

@router.get("/db/migrations")
def get_db_migrations():
    conn = get_db_connection()
    try:
        current = get_current_version(conn)
        available = sorted(MIGRATIONS.keys())
        pending = [v for v in available if v > current]
        return {
            "status": "success",
            "current_version": current,
            "latest_available": max(available) if available else 0,
            "pending_migrations": pending
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/db/migrations/apply")
def apply_db_migrations():
    conn = get_db_connection()
    try:
        current = get_current_version(conn)
        available = sorted(MIGRATIONS.keys())
        applied = []
        
        for v in available:
            if v > current:
                for stmt in MIGRATIONS[v]:
                    conn.execute(stmt)
                conn.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", (v, datetime.utcnow().isoformat()))
                conn.commit()
                applied.append(v)
                
        database.log_audit("db_migration", f"Applied database migrations: {applied}", "admin")
        return {
            "status": "success",
            "applied_migrations": applied,
            "new_version": get_current_version(conn)
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

