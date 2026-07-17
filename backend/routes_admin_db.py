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
