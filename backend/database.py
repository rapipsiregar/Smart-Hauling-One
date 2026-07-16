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
        vehicle_class TEXT NOT NULL DEFAULT 'Dump Truck',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    try: cursor.execute("ALTER TABLE crossings ADD COLUMN warning_status TEXT NOT NULL DEFAULT 'normal'")
    except sqlite3.OperationalError: pass
    try: cursor.execute("ALTER TABLE crossings ADD COLUMN is_duplicate INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError: pass
    try: cursor.execute("ALTER TABLE crossings ADD COLUMN vehicle_class TEXT NOT NULL DEFAULT 'Dump Truck'")
    except sqlite3.OperationalError: pass

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS telemetry_thresholds (
        key TEXT PRIMARY KEY,
        value REAL NOT NULL
    )
    """)
    cursor.execute("SELECT COUNT(*) FROM telemetry_thresholds")
    if cursor.fetchone()[0] == 0:
        cursor.executemany(
            "INSERT INTO telemetry_thresholds (key, value) VALUES (?, ?)",
            [("battery_low", 30.0), ("solar_low", 5.0), ("latency_high", 200.0)]
        )
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dispatch_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        message TEXT NOT NULL,
        recipient TEXT NOT NULL,
        channel TEXT NOT NULL
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contractor_compliance_targets (
        contractor TEXT PRIMARY KEY,
        target_rate REAL NOT NULL
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        operator TEXT NOT NULL
    )
    """)
    cursor.execute("SELECT COUNT(*) FROM contractor_compliance_targets")
    if cursor.fetchone()[0] == 0:
        cursor.executemany(
            "INSERT INTO contractor_compliance_targets (contractor, target_rate) VALUES (?, ?)",
            [("PT Tunas Inti Abadi", 2.0), ("PT Borneo Indah Cemerlang", 1.5), ("Ad-hoc Contractor", 0.5)]
        )
    conn.commit()
    from backend.database_stats import init_stats_db
    init_stats_db()
    
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
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO trucks (hull_id, contractor, model, status) VALUES (?, ?, ?, ?)", (hull_id, contractor, model, status))
        conn.commit(); return cursor.lastrowid
    finally: conn.close()

def get_all_trucks() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try: return [dict(r) for r in conn.execute("SELECT * FROM trucks ORDER BY hull_id ASC").fetchall()]
    finally: conn.close()

def get_truck_by_hull_id(hull_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT * FROM trucks WHERE hull_id = ?", (hull_id,)).fetchone()
        return dict(row) if row else None
    finally: conn.close()

def update_truck_status(hull_id: str, status: str) -> None:
    conn = get_db_connection()
    try: conn.execute("UPDATE trucks SET status = ? WHERE hull_id = ?", (status, hull_id)); conn.commit()
    finally: conn.close()

def update_truck(old_hull_id: str, new_hull_id: str, contractor: str, model: str, status: str) -> None:
    conn = get_db_connection()
    try:
        conn.execute(
            "UPDATE trucks SET hull_id = ?, contractor = ?, model = ?, status = ? WHERE hull_id = ?",
            (new_hull_id, contractor, model, status, old_hull_id)
        )
        conn.execute("UPDATE crossings SET hull_id = ? WHERE hull_id = ?", (new_hull_id, old_hull_id))
        conn.commit()
    finally:
        conn.close()

def delete_truck(hull_id: str) -> None:
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM trucks WHERE hull_id = ?", (hull_id,))
        conn.commit()
    finally:
        conn.close()

def insert_crossing(hull_id: str, confidence: float, timestamp: str, lane: str, direction: str, crop_image_path: Optional[str] = None, context_image_path: Optional[str] = None, warning_status: str = "normal", vehicle_class: str = "Dump Truck") -> int:
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        is_duplicate = 0
        row = cursor.execute("SELECT timestamp FROM crossings WHERE hull_id = ? AND lane = ? ORDER BY timestamp DESC LIMIT 1", (hull_id, lane)).fetchone()
        if row:
            try:
                from datetime import datetime
                pts = lambda s: datetime.fromisoformat(s.replace("Z", "").split("+")[0])
                if abs((pts(timestamp) - pts(row[0])).total_seconds()) <= 10.0: is_duplicate = 1
            except: pass
        last_dir = cursor.execute("SELECT direction FROM crossings WHERE hull_id = ? ORDER BY timestamp DESC LIMIT 1", (hull_id,)).fetchone()
        if last_dir and last_dir[0].strip().lower() == direction.strip().lower() and warning_status == "normal": warning_status = "cycle-discrepancy"
        cursor.execute("INSERT INTO crossings (hull_id, confidence, timestamp, lane, direction, crop_image_path, context_image_path, warning_status, is_duplicate, vehicle_class) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", (hull_id, confidence, timestamp, lane, direction, crop_image_path, context_image_path, warning_status, is_duplicate, vehicle_class))
        conn.commit(); return cursor.lastrowid
    finally: conn.close()

def get_all_crossings(lane: Optional[str] = None, hull_id: Optional[str] = None, vehicle_class: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        q, p = "SELECT * FROM crossings", []
        conds = []
        if lane: conds.append("lane = ?"); p.append(lane)
        if hull_id: conds.append("hull_id = ?"); p.append(hull_id)
        if vehicle_class: conds.append("vehicle_class = ?"); p.append(vehicle_class)
        if conds: q += " WHERE " + " AND ".join(conds)
        return [dict(r) for r in conn.execute(q + " ORDER BY timestamp DESC", p).fetchall()]
    finally: conn.close()

def update_crossing(crossing_id: int, hull_id: str, confidence: float, warning_status: str) -> None:
    conn = get_db_connection()
    try:
        conn.execute("UPDATE crossings SET hull_id = ?, confidence = ?, warning_status = ? WHERE id = ?", (hull_id, confidence, warning_status, crossing_id))
        conn.commit()
    finally: conn.close()

def get_crossing_by_id(crossing_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT * FROM crossings WHERE id = ?", (crossing_id,)).fetchone()
        return dict(row) if row else None
    finally: conn.close()

def clear_and_restore_db(trucks: list, crossings: list) -> None:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM crossings"); cursor.execute("DELETE FROM trucks")
        cursor.executemany("INSERT INTO trucks (hull_id, contractor, model, status, created_at) VALUES (?, ?, ?, ?, ?)", [(t["hull_id"], t["contractor"], t["model"], t.get("status", "active"), t.get("created_at")) for t in trucks])
        cursor.executemany("INSERT INTO crossings (id, hull_id, confidence, timestamp, lane, direction, crop_image_path, context_image_path, warning_status, is_duplicate, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [(c.get("id"), c["hull_id"], c["confidence"], c["timestamp"], c["lane"], c["direction"], c.get("crop_image_path"), c.get("context_image_path"), c.get("warning_status", "normal"), c.get("is_duplicate", 0), c.get("created_at")) for c in crossings])
        conn.commit()
    finally: conn.close()

def get_thresholds() -> Dict[str, float]:
    conn = get_db_connection()
    try:
        rows = conn.execute("SELECT key, value FROM telemetry_thresholds").fetchall()
        return {**{"battery_low": 30.0, "solar_low": 5.0, "latency_high": 200.0}, **{r[0]: r[1] for r in rows}}
    except: return {"battery_low": 30.0, "solar_low": 5.0, "latency_high": 200.0}
    finally: conn.close()

def set_thresholds(thresholds: Dict[str, float]) -> None:
    conn = get_db_connection()
    try:
        conn.executemany("INSERT INTO telemetry_thresholds (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [(k, float(v)) for k, v in thresholds.items()])
        conn.commit()
    finally: conn.close()

def log_dispatch(alert_type: str, message: str, recipient: str, channel: str) -> None:
    from datetime import datetime
    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO dispatch_logs (timestamp, alert_type, message, recipient, channel) VALUES (?, ?, ?, ?, ?)", (datetime.utcnow().isoformat(), alert_type, message, recipient, channel))
        conn.commit()
    finally: conn.close()

def get_all_dispatches() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try: return [dict(r) for r in conn.execute("SELECT * FROM dispatch_logs ORDER BY id DESC").fetchall()]
    finally: conn.close()

def get_contractor_targets() -> Dict[str, float]:
    conn = get_db_connection()
    try:
        rows = conn.execute("SELECT contractor, target_rate FROM contractor_compliance_targets").fetchall()
        return {**{"PT Tunas Inti Abadi": 2.0, "PT Borneo Indah Cemerlang": 1.5, "Ad-hoc Contractor": 0.5}, **{r[0]: r[1] for r in rows}}
    except Exception: return {"PT Tunas Inti Abadi": 2.0, "PT Borneo Indah Cemerlang": 1.5, "Ad-hoc Contractor": 0.5}
    finally: conn.close()

def set_contractor_target(contractor: str, target_rate: float) -> None:
    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO contractor_compliance_targets (contractor, target_rate) VALUES (?, ?) ON CONFLICT(contractor) DO UPDATE SET target_rate=excluded.target_rate", (contractor, float(target_rate)))
        conn.commit()
    finally: conn.close()

def log_audit(action: str, details: str, operator: str = "supervisor") -> None:
    from datetime import datetime
    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO audit_logs (timestamp, action, details, operator) VALUES (?, ?, ?, ?)", (datetime.utcnow().isoformat(), action, details, operator))
        conn.commit()
    finally: conn.close()

def get_all_audits() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try: return [dict(r) for r in conn.execute("SELECT * FROM audit_logs ORDER BY id DESC").fetchall()]
    finally: conn.close()



