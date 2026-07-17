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
    from backend.database_init import run_init_db
    run_init_db()

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
        mode = get_system_setting("active_mode", "demo")
        cursor.execute("INSERT INTO crossings (hull_id, confidence, timestamp, lane, direction, crop_image_path, context_image_path, warning_status, is_duplicate, vehicle_class, mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", (hull_id, confidence, timestamp, lane, direction, crop_image_path, context_image_path, warning_status, is_duplicate, vehicle_class, mode))
        conn.commit(); return cursor.lastrowid
    finally: conn.close()

def get_all_crossings(lane: Optional[str] = None, hull_id: Optional[str] = None, vehicle_class: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        mode = get_system_setting("active_mode", "demo")
        q, p = "SELECT * FROM crossings WHERE mode = ?", [mode]
        conds = []
        if lane: conds.append("lane = ?"); p.append(lane)
        if hull_id: conds.append("hull_id = ?"); p.append(hull_id)
        if vehicle_class: conds.append("vehicle_class = ?"); p.append(vehicle_class)
        if conds: q += " AND " + " AND ".join(conds)
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
        return {**{"battery_low": 30.0, "solar_low": 5.0, "latency_high": 200.0, "ocr_confidence_min": 85.0}, **{r[0]: r[1] for r in rows}}
    except: return {"battery_low": 30.0, "solar_low": 5.0, "latency_high": 200.0, "ocr_confidence_min": 85.0}
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

def get_contractor_min_fleet() -> Dict[str, int]:
    conn = get_db_connection()
    try:
        rows = conn.execute("SELECT contractor, min_active_fleet FROM contractor_compliance_targets").fetchall()
        return {**{"PT Tunas Inti Abadi": 5, "PT Borneo Indah Cemerlang": 5, "Ad-hoc Contractor": 2}, **{r[0]: int(r[1]) for r in rows if r[1] is not None}}
    except Exception: return {"PT Tunas Inti Abadi": 5, "PT Borneo Indah Cemerlang": 5, "Ad-hoc Contractor": 2}
    finally: conn.close()

def set_contractor_target(contractor: str, target_rate: float, min_active_fleet: Optional[int] = None) -> None:
    conn = get_db_connection()
    try:
        if min_active_fleet is not None:
            conn.execute("INSERT INTO contractor_compliance_targets (contractor, target_rate, min_active_fleet) VALUES (?, ?, ?) ON CONFLICT(contractor) DO UPDATE SET target_rate=excluded.target_rate, min_active_fleet=excluded.min_active_fleet", (contractor, float(target_rate), int(min_active_fleet)))
        else:
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

def get_system_setting(key: str, default: str) -> str:
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT value FROM system_settings WHERE key = ?", (key,)).fetchone()
        return row[0] if row else default
    except Exception: return default
    finally: conn.close()

def set_system_setting(key: str, value: str) -> None:
    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))
        conn.commit()
    finally: conn.close()

def insert_discrepancy_resolution(discrepancy_id: str, operator_notes: str, resolved_by: str = "supervisor") -> None:
    from datetime import datetime
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO discrepancy_resolutions (discrepancy_id, operator_notes, resolved_at, resolved_by) VALUES (?, ?, ?, ?) ON CONFLICT(discrepancy_id) DO UPDATE SET operator_notes=excluded.operator_notes, resolved_at=excluded.resolved_at, resolved_by=excluded.resolved_by",
            (discrepancy_id, operator_notes, datetime.utcnow().isoformat(), resolved_by)
        )
        conn.commit()
    finally: conn.close()

def get_all_discrepancy_resolutions() -> Dict[str, Dict[str, Any]]:
    conn = get_db_connection()
    try:
        rows = conn.execute("SELECT * FROM discrepancy_resolutions").fetchall()
        return {r["discrepancy_id"]: dict(r) for r in rows}
    finally: conn.close()



