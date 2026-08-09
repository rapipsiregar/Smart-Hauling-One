"""Write operations on the truck registry and crossing reconciliation.

Each mutation invalidates the dashboard cache so the next read reflects it.
"""

from __future__ import annotations

from app.core.config import UNIDENTIFIED_HULLS
from app.repositories import truck_registry_repo
from app.services.dataset import invalidate_cache

_UNRESOLVED_HULLS = UNIDENTIFIED_HULLS | {"UNIDENTIFIED"}


def update_crossing(crossing_id: int, hull_id: str, confidence: float | None = None) -> bool:
    """Reassign a crossing's hull id (1-based id), auto-registering new trucks."""
    from app.core.database import connect

    norm_conf = (confidence / 100.0) if (confidence is not None and confidence > 1.0) else (confidence if confidence is not None else 1.0)

    # 1. Primary persistence: SQLite video_results table
    db_updated = False
    conn = None
    try:
        conn = connect()
        cur = conn.execute(
            "UPDATE video_results SET voted_hull_id = ?, vote_confidence = ? WHERE id = ?",
            (hull_id, norm_conf, crossing_id),
        )
        conn.commit()
        db_updated = cur.rowcount > 0
    except Exception:
        pass
    finally:
        if conn:
            conn.close()

    # 2. Legacy fallback persistence: results JSON
    results = truck_registry_repo.read_results()
    idx = crossing_id - 1
    json_updated = False
    if 0 <= idx < len(results):
        results[idx]["voted_hull_id"] = hull_id
        results[idx]["vote_confidence"] = norm_conf
        truck_registry_repo.write_results(results)
        json_updated = True

    if hull_id not in _UNRESOLVED_HULLS:
        registered = truck_registry_repo.read_registered_trucks()
        if hull_id not in registered:
            registered[hull_id] = {"hull_id": hull_id, "status": "active"}
            truck_registry_repo.write_registered_trucks(registered)

    invalidate_cache()
    return db_updated or json_updated


def add_truck(hull_id: str, status: str = "active") -> bool:
    if not hull_id:
        return False
    registered = truck_registry_repo.read_registered_trucks()
    if hull_id in registered:
        return False
    registered[hull_id] = {"hull_id": hull_id, "status": status}
    truck_registry_repo.write_registered_trucks(registered)
    invalidate_cache()
    return True


def update_truck(old_hull_id: str, new_hull_id: str, status: str) -> bool:
    if not old_hull_id:
        return False
    registered = truck_registry_repo.read_registered_trucks()
    if old_hull_id not in registered:
        return False

    registered.pop(old_hull_id)

    if new_hull_id and new_hull_id != old_hull_id:
        results = truck_registry_repo.read_results()
        changed = False
        for r in results:
            if r.get("voted_hull_id") == old_hull_id:
                r["voted_hull_id"] = new_hull_id
                changed = True
        if changed:
            truck_registry_repo.write_results(results)
        registered[new_hull_id] = {"hull_id": new_hull_id, "status": status}
    else:
        registered[old_hull_id] = {"hull_id": old_hull_id, "status": status}

    truck_registry_repo.write_registered_trucks(registered)
    invalidate_cache()
    return True


def delete_truck(hull_id: str) -> bool:
    if not hull_id:
        return False
    registered = truck_registry_repo.read_registered_trucks()
    if hull_id not in registered:
        return False

    registered.pop(hull_id)
    truck_registry_repo.write_registered_trucks(registered)

    results = truck_registry_repo.read_results()
    changed = False
    for r in results:
        if r.get("voted_hull_id") == hull_id:
            r["voted_hull_id"] = "UNKNOWN"
            changed = True
    if changed:
        truck_registry_repo.write_results(results)

    invalidate_cache()
    return True
