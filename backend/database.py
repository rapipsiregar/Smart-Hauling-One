import sqlite3
import os
from typing import List, Dict, Any, Optional

DB_PATH = os.environ.get("SQLITE_DB_PATH", "data/smart_gate.db")

def get_db_connection():
    # Ensure data directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create trucks table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS trucks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hull_id TEXT UNIQUE NOT NULL,
        contractor TEXT NOT NULL,
        model TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create crossings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS crossings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hull_id TEXT NOT NULL,
        confidence REAL NOT NULL,
        timestamp TEXT NOT NULL,
        lane TEXT NOT NULL,
        direction TEXT NOT NULL,
        crop_image_path TEXT,
        context_image_path TEXT,
        warning_status TEXT NOT NULL DEFAULT 'normal',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Run migration to add warning_status if it is missing
    try:
        cursor.execute("ALTER TABLE crossings ADD COLUMN warning_status TEXT NOT NULL DEFAULT 'normal'")
    except sqlite3.OperationalError:
        pass

    conn.commit()
    
    # Seed data if empty
    cursor.execute("SELECT COUNT(*) FROM trucks")
    if cursor.fetchone()[0] == 0:
        seed_trucks = [
            ("DT-118", "PT Tunas Inti Abadi", "Caterpillar 777D", "active"),
            ("DT-119", "PT Tunas Inti Abadi", "Caterpillar 777D", "active"),
            ("DT-120", "PT Borneo Indah Cemerlang", "Caterpillar 773E", "active"),
            ("DT-121", "PT Borneo Indah Cemerlang", "Caterpillar 773E", "active"),
            ("DT-202", "PT Borneo Indah Cemerlang", "Caterpillar 777E", "active"),
        ]
        cursor.executemany(
            "INSERT INTO trucks (hull_id, contractor, model, status) VALUES (?, ?, ?, ?)",
            seed_trucks
        )
        conn.commit()
        
    conn.close()

def insert_truck(hull_id: str, contractor: str, model: str, status: str = "active") -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO trucks (hull_id, contractor, model, status) VALUES (?, ?, ?, ?)",
            (hull_id, contractor, model, status)
        )
        conn.commit()
        last_id = cursor.lastrowid
        return last_id
    finally:
        conn.close()

def get_all_trucks() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM trucks ORDER BY hull_id ASC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

def get_truck_by_hull_id(hull_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM trucks WHERE hull_id = ?", (hull_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def insert_crossing(
    hull_id: str,
    confidence: float,
    timestamp: str,
    lane: str,
    direction: str,
    crop_image_path: Optional[str] = None,
    context_image_path: Optional[str] = None,
    warning_status: str = "normal"
) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO crossings (
                hull_id, confidence, timestamp, lane, direction, crop_image_path, context_image_path, warning_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (hull_id, confidence, timestamp, lane, direction, crop_image_path, context_image_path, warning_status)
        )
        conn.commit()
        last_id = cursor.lastrowid
        return last_id
    finally:
        conn.close()

def get_all_crossings(lane: Optional[str] = None, hull_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        query = "SELECT * FROM crossings"
        params = []
        conditions = []
        
        if lane:
            conditions.append("lane = ?")
            params.append(lane)
        if hull_id:
            conditions.append("hull_id = ?")
            params.append(hull_id)
            
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
            
        query += " ORDER BY timestamp DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()
