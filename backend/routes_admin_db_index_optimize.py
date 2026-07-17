import time
from fastapi import APIRouter, HTTPException
from backend.database import get_db_connection

router = APIRouter()

@router.post("/admin/db/index-optimize")
def optimize_database_indices():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='crossings'")
        pre_indices = [row[0] for row in cursor.fetchall()]
        
        t0 = time.perf_counter()
        cursor.execute("SELECT * FROM crossings WHERE hull_id = 'DT-118' ORDER BY timestamp DESC LIMIT 50").fetchall()
        t1 = time.perf_counter()
        pre_query_duration_ms = (t1 - t0) * 1000.0
        
        created = []
        target_indices = {
            "idx_crossings_hull_id": "CREATE INDEX IF NOT EXISTS idx_crossings_hull_id ON crossings (hull_id)",
            "idx_crossings_timestamp": "CREATE INDEX IF NOT EXISTS idx_crossings_timestamp ON crossings (timestamp)",
            "idx_crossings_mode": "CREATE INDEX IF NOT EXISTS idx_crossings_mode ON crossings (mode)",
            "idx_crossings_lane": "CREATE INDEX IF NOT EXISTS idx_crossings_lane ON crossings (lane)"
        }
        
        for index_name, create_sql in target_indices.items():
            if index_name not in pre_indices:
                cursor.execute(create_sql)
                created.append(index_name)
                
        conn.commit()
        
        cursor.execute("REINDEX crossings")
        cursor.execute("ANALYZE crossings")
        conn.commit()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='crossings'")
        post_indices = [row[0] for row in cursor.fetchall()]
        
        t2 = time.perf_counter()
        cursor.execute("SELECT * FROM crossings WHERE hull_id = 'DT-118' ORDER BY timestamp DESC LIMIT 50").fetchall()
        t3 = time.perf_counter()
        post_query_duration_ms = (t3 - t2) * 1000.0
        
        try:
            from datetime import datetime
            cursor.execute(
                "INSERT INTO audit_logs (timestamp, action, details, operator) VALUES (?, ?, ?, ?)",
                (
                    datetime.utcnow().isoformat(),
                    "Database Index Optimization",
                    f"Created: {', '.join(created) or 'None'}. Ran REINDEX/ANALYZE on crossings.",
                    "System Advisor"
                )
            )
            conn.commit()
        except Exception:
            pass
            
        return {
            "status": "success",
            "table": "crossings",
            "pre_indices": pre_indices,
            "created_indices": created,
            "post_indices": post_indices,
            "pre_query_duration_ms": round(pre_query_duration_ms, 4),
            "post_query_duration_ms": round(post_query_duration_ms, 4),
            "performance_improvement_pct": round(((pre_query_duration_ms - post_query_duration_ms) / max(pre_query_duration_ms, 0.0001)) * 100.0, 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
