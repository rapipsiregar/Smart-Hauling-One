"""Central inference of device offline status (``docs/edge-system/SRS.md`` §5.1).

A device never reports itself offline -- it only ever claims ``online`` or
``maintenance``. Silence is what means offline, and only the induk can observe
silence. This sweep is that observation.

A device that has gone quiet flips to ``offline`` even if its last self-report was
``maintenance``: "no news" must never be displayed as "known, attended
maintenance".
"""

from __future__ import annotations

import os
import threading

from app.core.config import HEARTBEAT_INTERVAL_SEC, OFFLINE_THRESHOLD_SEC
from app.repositories import edge_repo
from app.utils.timeutil import utc_iso_seconds_ago

# Inverted sense: setting this requests shutdown. Event.wait() doubles as an
# interruptible sleep, so the process never hangs 30s waiting to exit.
_shutdown = threading.Event()


def sweep_once() -> int:
    """Flip every silent device to ``offline``. Returns how many changed.

    Devices with ``last_heartbeat_at IS NULL`` (provisioned but never deployed)
    are left alone -- there is nothing to infer from silence that was never
    preceded by contact.
    """
    threshold = utc_iso_seconds_ago(OFFLINE_THRESHOLD_SEC)
    changed = edge_repo.sweep_offline(threshold)
    if changed:
        print(
            f"device_status: {changed} device(s) -> offline "
            f"(no heartbeat since {threshold})"
        )
    return changed


def _loop() -> None:
    # Same cadence as the heartbeat interval, so staleness is detected within one
    # extra cycle at most (SRS §5.1).
    while not _shutdown.wait(timeout=HEARTBEAT_INTERVAL_SEC):
        try:
            sweep_once()
        except Exception as err:  # pragma: no cover - the sweep must never die
            print(f"device_status: sweep failed: {err}")


def start_background_sweep() -> threading.Thread | None:
    """Start the sweep loop as a daemon thread.

    Returns ``None`` when disabled via ``DISABLE_EDGE_SWEEP=true`` -- useful for
    CLI invocations and any environment that should not mutate device status.
    """
    if os.environ.get("DISABLE_EDGE_SWEEP", "").lower() in ("1", "true", "yes"):
        print("device_status: background sweep disabled via DISABLE_EDGE_SWEEP")
        return None
    _shutdown.clear()
    thread = threading.Thread(target=_loop, name="edge-offline-sweep", daemon=True)
    thread.start()
    return thread


def stop_background_sweep() -> None:
    """Signal the loop to exit at its next tick."""
    _shutdown.set()
