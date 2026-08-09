"""Wipe recorded crossings so a test can be repeated from an empty database.

A development convenience, and scoped deliberately narrowly: it removes what a
detection run PRODUCES, never what the system was configured WITH.

Kept, always:
  * the truck master -- the 276-unit roster imported from the operator's
    spreadsheet. Losing it means every later reading resolves to UNKNOWN until
    somebody re-imports it, which looks exactly like a broken pipeline.
  * the camera registry -- codes, gate directions and RTSP addresses. Direction
    in particular decides whether a crossing counts as an arrival or a
    departure, and the devices identify themselves by these codes.
  * device API keys -- clearing them would silently lock all four gates out
    until each is re-provisioned by hand.

Removed:
  * video_results (the crossings) and their detections
  * runs
  * the plate snapshots those crossings wrote to disk
"""

from __future__ import annotations

import os

from app.core.config import SNAPSHOT_DIR
from app.core.database import connect
from app.services.dataset import invalidate_cache

# Gate consoles to clear alongside this one, comma-separated base URLs.
# Each device keeps its own database, so clearing the centre alone leaves the
# gates holding readings the centre no longer has -- a repeat test then starts
# from two stores that disagree. Unset means "centre only", and the response
# says so rather than implying the gates were handled.
GATE_URLS = [u.strip() for u in os.environ.get("DEV_GATE_RESET_URLS", "").split(",") if u.strip()]


def count_crossings() -> dict:
    """What a reset would remove, for showing before anything is deleted."""
    conn = connect()
    try:
        return {
            "crossings": conn.execute("SELECT COUNT(*) FROM video_results").fetchone()[0],
            "detections": conn.execute("SELECT COUNT(*) FROM detections").fetchone()[0],
            "runs": conn.execute("SELECT COUNT(*) FROM runs").fetchone()[0],
        }
    finally:
        conn.close()


def reset() -> dict:
    """Delete every crossing. Returns what was removed and what was kept."""
    before = count_crossings()

    conn = connect()
    try:
        # Detections reference video_results, so they go first.
        conn.execute("DELETE FROM detections")
        conn.execute("DELETE FROM video_results")
        conn.execute("DELETE FROM runs")
        conn.commit()
        kept = {
            "trucks": conn.execute("SELECT COUNT(*) FROM trucks").fetchone()[0],
            "cameras": conn.execute("SELECT COUNT(*) FROM cameras").fetchone()[0],
        }
    finally:
        conn.close()

    # The rows are gone; their images would otherwise linger as orphans that no
    # page can reach and no later reset would find.
    snapshots = 0
    if SNAPSHOT_DIR.is_dir():
        for image in SNAPSHOT_DIR.glob("edge-*.jpg"):
            image.unlink(missing_ok=True)
            snapshots += 1

    # build_dataset() is memoised, so without this the pages keep serving the
    # crossings that no longer exist.
    invalidate_cache()

    return {
        "status": "success",
        "removed": {**before, "snapshots": snapshots},
        "kept": kept,
        "gates": _reset_gates(),
    }


def _reset_gates() -> list[dict]:
    """Clear each configured gate's own history too.

    Reported per gate, including the failures. A gate that could not be reached
    still holds its readings, and saying so is the difference between an
    operator knowing to go clear it and believing the whole system is empty.
    """
    import json
    import urllib.request

    results = []
    for url in GATE_URLS:
        entry = {"url": url}
        try:
            request = urllib.request.Request(
                f"{url.rstrip('/')}/api/crossings-reset", method="POST"
            )
            with urllib.request.urlopen(request, timeout=10) as response:
                body = json.loads(response.read())
            entry.update(ok=True, removed=body.get("removed", {}))
        except Exception as err:
            entry.update(ok=False, error=f"{type(err).__name__}: {err}")
        results.append(entry)
    return results
