import sqlite3
from backend.database import get_db_connection

def run_init_db():
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
    try: cursor.execute("ALTER TABLE crossings ADD COLUMN mode TEXT NOT NULL DEFAULT 'demo'")
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
    try: cursor.execute("ALTER TABLE contractor_compliance_targets ADD COLUMN min_active_fleet INTEGER NOT NULL DEFAULT 5")
    except sqlite3.OperationalError: pass

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)
    cursor.execute("SELECT COUNT(*) FROM system_settings WHERE key='active_mode'")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO system_settings (key, value) VALUES ('active_mode', 'demo')")
    cursor.execute("SELECT COUNT(*) FROM system_settings WHERE key='rtsp_url'")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO system_settings (key, value) VALUES ('rtsp_url', 'rtsp://localhost:8554/live')")

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
